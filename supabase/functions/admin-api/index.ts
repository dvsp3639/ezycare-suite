import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user and check role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is super_admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    const isSuperAdmin = !!roleData;

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/admin-api\/?/, "");
    const method = req.method;

    // ========== PUBLIC: Get user role info ==========
    if (path === "me" && method === "GET") {
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("role, hospital_id")
        .eq("user_id", userId);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(
        JSON.stringify({ user: claimsData.user, profile, roles }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== SUPER ADMIN ONLY ROUTES ==========
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- HOSPITALS CRUD ----------
    if (path === "hospitals" && method === "GET") {
      const { data, error } = await adminClient
        .from("hospitals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "hospitals" && method === "POST") {
      const body = await req.json();
      const { name, address, city, state, phone, email, license_number } = body;
      if (!name) throw new Error("Hospital name is required");

      const { data, error } = await adminClient
        .from("hospitals")
        .insert({ name, address, city, state, phone, email, license_number })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hospitalMatch = path.match(/^hospitals\/([a-f0-9-]+)$/);
    if (hospitalMatch && method === "PUT") {
      const hospitalId = hospitalMatch[1];
      const body = await req.json();
      const { name, address, city, state, phone, email, license_number, is_active } = body;

      const { data, error } = await adminClient
        .from("hospitals")
        .update({ name, address, city, state, phone, email, license_number, is_active })
        .eq("id", hospitalId)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hospitalMatch && method === "DELETE") {
      const hospitalId = hospitalMatch[1];
      const { error } = await adminClient
        .from("hospitals")
        .delete()
        .eq("id", hospitalId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- HOSPITAL ADMINS ----------
    if (path === "hospital-admins" && method === "GET") {
      const hospitalId = url.searchParams.get("hospital_id");

      let query = adminClient
        .from("user_roles")
        .select("id, user_id, role, hospital_id")
        .eq("role", "hospital_admin");

      if (hospitalId) {
        query = query.eq("hospital_id", hospitalId);
      }

      const { data: roles, error } = await query;
      if (error) throw error;

      // Fetch profiles for these users
      const userIds = roles?.map((r: any) => r.user_id) || [];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profileData } = await adminClient
          .from("profiles")
          .select("*")
          .in("user_id", userIds);
        profiles = profileData || [];
      }

      // Fetch emails from auth
      const adminsWithDetails = await Promise.all(
        (roles || []).map(async (role: any) => {
          const { data: authUser } = await adminClient.auth.admin.getUserById(role.user_id);
          const profile = profiles.find((p: any) => p.user_id === role.user_id);
          return {
            ...role,
            email: authUser?.user?.email,
            full_name: profile?.full_name,
            phone: profile?.phone,
          };
        })
      );

      return new Response(JSON.stringify(adminsWithDetails), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "hospital-admins" && method === "POST") {
      const body = await req.json();
      const { email, password, full_name, phone, hospital_id } = body;

      if (!email || !password || !hospital_id) {
        throw new Error("email, password, and hospital_id are required");
      }

      // Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (authError) throw authError;

      // Assign hospital_admin role
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "hospital_admin",
          hospital_id,
        });

      if (roleError) throw roleError;

      // Update profile name if provided
      if (full_name || phone) {
        await adminClient
          .from("profiles")
          .update({ full_name: full_name || email, phone })
          .eq("user_id", authData.user.id);
      }

      return new Response(
        JSON.stringify({ user_id: authData.user.id, email, hospital_id }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminMatch = path.match(/^hospital-admins\/([a-f0-9-]+)$/);
    if (adminMatch && method === "DELETE") {
      const roleId = adminMatch[1];

      // Get user_id from role
      const { data: roleRecord } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("id", roleId)
        .single();

      if (roleRecord) {
        // Delete role
        await adminClient.from("user_roles").delete().eq("id", roleId);
        // Delete auth user
        await adminClient.auth.admin.deleteUser(roleRecord.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- ANALYTICS ----------
    if (path === "analytics" && method === "GET") {
      const { count: hospitalCount } = await adminClient
        .from("hospitals")
        .select("*", { count: "exact", head: true });

      const { count: activeHospitalCount } = await adminClient
        .from("hospitals")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: adminCount } = await adminClient
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "hospital_admin");

      const { data: recentHospitals } = await adminClient
        .from("hospitals")
        .select("id, name, city, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      return new Response(
        JSON.stringify({
          total_hospitals: hospitalCount || 0,
          active_hospitals: activeHospitalCount || 0,
          total_admins: adminCount || 0,
          recent_hospitals: recentHospitals || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin API error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
