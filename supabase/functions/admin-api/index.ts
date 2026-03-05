import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ROLES = ["hospital_admin", "doctor", "nurse", "lab_technician", "pharmacist", "staff", "receptionist"];
const HOSPITAL_ADMIN_MANAGEABLE_ROLES = ["doctor", "nurse", "lab_technician", "pharmacist", "receptionist"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check caller's role
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

    // ========== PUBLIC: Get user info ==========
    if (path === "me" && (method === "GET" || method === "POST")) {
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

    // Check if hospital_admin
    const { data: hospitalAdminRole } = await adminClient
      .from("user_roles")
      .select("role, hospital_id")
      .eq("user_id", userId)
      .eq("role", "hospital_admin")
      .maybeSingle();

    const isHospitalAdmin = !!hospitalAdminRole;
    const adminHospitalId = hospitalAdminRole?.hospital_id;

    // ========== HOSPITAL ADMIN: Users CRUD for their hospital ==========
    if (isHospitalAdmin && !isSuperAdmin) {
      // Hospital admin can only manage users in their hospital
      if (path === "hospital-users" && method === "GET") {
        if (!adminHospitalId) throw new Error("No hospital assigned");

        let query = adminClient
          .from("user_roles")
          .select("id, user_id, role, hospital_id")
          .eq("hospital_id", adminHospitalId)
          .in("role", HOSPITAL_ADMIN_MANAGEABLE_ROLES);

        const roleFilter = url.searchParams.get("role");
        if (roleFilter) query = query.eq("role", roleFilter);

        const { data: roles, error } = await query;
        if (error) throw error;

        const userIds = roles?.map((r: any) => r.user_id) || [];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: profileData } = await adminClient
            .from("profiles")
            .select("*")
            .in("user_id", userIds);
          profiles = profileData || [];
        }

        const usersWithDetails = await Promise.all(
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

        return new Response(JSON.stringify(usersWithDetails), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (path === "hospital-users" && method === "POST") {
        const body = await req.json();
        const { email, password, full_name, phone, role } = body;

        if (!email || !password || !role) {
          throw new Error("email, password, and role are required");
        }
        if (!HOSPITAL_ADMIN_MANAGEABLE_ROLES.includes(role)) {
          throw new Error(`Invalid role. Must be one of: ${HOSPITAL_ADMIN_MANAGEABLE_ROLES.join(", ")}`);
        }

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || email },
        });
        if (authError) throw authError;

        const { error: roleError } = await adminClient
          .from("user_roles")
          .insert({ user_id: authData.user.id, role, hospital_id: adminHospitalId });
        if (roleError) throw roleError;

        if (full_name || phone) {
          await adminClient
            .from("profiles")
            .update({ full_name: full_name || email, phone })
            .eq("user_id", authData.user.id);
        }

        return new Response(
          JSON.stringify({ user_id: authData.user.id, email, role, hospital_id: adminHospitalId }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hospitalUserMatch = path.match(/^hospital-users\/([a-f0-9-]+)$/);
      if (hospitalUserMatch && method === "PUT") {
        const roleId = hospitalUserMatch[1];
        const body = await req.json();
        const { full_name, phone, role } = body;

        const { data: roleRecord } = await adminClient
          .from("user_roles")
          .select("user_id, hospital_id")
          .eq("id", roleId)
          .single();

        if (!roleRecord) throw new Error("User role not found");
        if (roleRecord.hospital_id !== adminHospitalId) throw new Error("Access denied");

        if (role) {
          if (!HOSPITAL_ADMIN_MANAGEABLE_ROLES.includes(role)) throw new Error("Invalid role");
          await adminClient.from("user_roles").update({ role }).eq("id", roleId);
        }

        if (full_name || phone) {
          const profileUpdate: any = {};
          if (full_name) profileUpdate.full_name = full_name;
          if (phone) profileUpdate.phone = phone;
          await adminClient.from("profiles").update(profileUpdate).eq("user_id", roleRecord.user_id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (hospitalUserMatch && method === "DELETE") {
        const roleId = hospitalUserMatch[1];
        const { data: roleRecord } = await adminClient
          .from("user_roles")
          .select("user_id, hospital_id")
          .eq("id", roleId)
          .single();

        if (!roleRecord) throw new Error("User role not found");
        if (roleRecord.hospital_id !== adminHospitalId) throw new Error("Access denied");

        await adminClient.from("user_roles").delete().eq("id", roleId);
        await adminClient.auth.admin.deleteUser(roleRecord.user_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hospital admin cannot access other endpoints
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== SUPER ADMIN ONLY ==========
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
      const { error } = await adminClient.from("hospitals").delete().eq("id", hospitalId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- STAFF / USERS CRUD (all roles) ----------
    if (path === "users" && method === "GET") {
      const hospitalId = url.searchParams.get("hospital_id");
      const role = url.searchParams.get("role");

      let query = adminClient
        .from("user_roles")
        .select("id, user_id, role, hospital_id")
        .in("role", VALID_ROLES);

      if (hospitalId) query = query.eq("hospital_id", hospitalId);
      if (role) query = query.eq("role", role);

      const { data: roles, error } = await query;
      if (error) throw error;

      const userIds = roles?.map((r: any) => r.user_id) || [];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profileData } = await adminClient
          .from("profiles")
          .select("*")
          .in("user_id", userIds);
        profiles = profileData || [];
      }

      const usersWithDetails = await Promise.all(
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

      return new Response(JSON.stringify(usersWithDetails), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "users" && method === "POST") {
      const body = await req.json();
      const { email, password, full_name, phone, hospital_id, role } = body;

      if (!email || !password || !hospital_id || !role) {
        throw new Error("email, password, hospital_id, and role are required");
      }
      if (!VALID_ROLES.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
      }

      // Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || email },
      });
      if (authError) throw authError;

      // Assign role
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: authData.user.id, role, hospital_id });
      if (roleError) throw roleError;

      // Update profile
      if (full_name || phone) {
        await adminClient
          .from("profiles")
          .update({ full_name: full_name || email, phone })
          .eq("user_id", authData.user.id);
      }

      return new Response(
        JSON.stringify({ user_id: authData.user.id, email, role, hospital_id }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMatch = path.match(/^users\/([a-f0-9-]+)$/);
    if (userMatch && method === "PUT") {
      const roleId = userMatch[1];
      const body = await req.json();
      const { full_name, phone, role, hospital_id } = body;

      // Get current role record
      const { data: roleRecord } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("id", roleId)
        .single();

      if (!roleRecord) throw new Error("User role not found");

      // Update role/hospital if changed
      const updateData: any = {};
      if (role) updateData.role = role;
      if (hospital_id) updateData.hospital_id = hospital_id;
      if (Object.keys(updateData).length > 0) {
        await adminClient.from("user_roles").update(updateData).eq("id", roleId);
      }

      // Update profile
      if (full_name || phone) {
        const profileUpdate: any = {};
        if (full_name) profileUpdate.full_name = full_name;
        if (phone) profileUpdate.phone = phone;
        await adminClient.from("profiles").update(profileUpdate).eq("user_id", roleRecord.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userMatch && method === "DELETE") {
      const roleId = userMatch[1];
      const { data: roleRecord } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("id", roleId)
        .single();

      if (roleRecord) {
        await adminClient.from("user_roles").delete().eq("id", roleId);
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

      const { count: totalUsers } = await adminClient
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("role", VALID_ROLES);

      // Count by role
      const roleCounts: Record<string, number> = {};
      for (const role of VALID_ROLES) {
        const { count } = await adminClient
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", role);
        roleCounts[role] = count || 0;
      }

      const { data: recentHospitals } = await adminClient
        .from("hospitals")
        .select("id, name, city, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      return new Response(
        JSON.stringify({
          total_hospitals: hospitalCount || 0,
          active_hospitals: activeHospitalCount || 0,
          total_users: totalUsers || 0,
          role_counts: roleCounts,
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
