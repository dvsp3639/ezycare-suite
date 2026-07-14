import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Users, Plus, Pencil, Power, KeyRound, LogOut, Loader2, Shield } from "lucide-react";

interface Hospital {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  license_number?: string;
  is_active: boolean;
  created_at: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  hospital_id: string;
  email?: string;
  full_name?: string;
  phone?: string;
}

const emptyHospital = { name: "", address: "", city: "", state: "", phone: "", email: "", license_number: "" };
const emptyAdmin = { email: "", password: "", full_name: "", phone: "", hospital_id: "" };

export default function SuperAdminConsole() {
  const { logout, session } = useAuth();
  const navigate = useNavigate();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [hDialog, setHDialog] = useState<{ open: boolean; edit?: Hospital }>({ open: false });
  const [hForm, setHForm] = useState(emptyHospital);
  const [hSaving, setHSaving] = useState(false);

  const [aDialog, setADialog] = useState<{ open: boolean; edit?: AdminUser }>({ open: false });
  const [aForm, setAForm] = useState(emptyAdmin);
  const [aSaving, setASaving] = useState(false);

  const [pwDialog, setPwDialog] = useState<{ open: boolean; admin?: AdminUser }>({ open: false });
  const [pwValue, setPwValue] = useState("");

  const api = async (path: string, options: { method?: string; body?: any } = {}) => {
    const { data, error } = await supabase.functions.invoke(`admin-api/${path}`, {
      method: (options.method as any) || "GET",
      body: options.body,
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [h, u] = await Promise.all([
        api("hospitals"),
        api("users?role=hospital_admin"),
      ]);
      setHospitals(h || []);
      setAdmins(u || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadAll();
  }, [session]);

  // ---------- Hospitals ----------
  const openHospital = (h?: Hospital) => {
    setHForm(h ? {
      name: h.name, address: h.address || "", city: h.city || "", state: h.state || "",
      phone: h.phone || "", email: h.email || "", license_number: h.license_number || "",
    } : emptyHospital);
    setHDialog({ open: true, edit: h });
  };

  const saveHospital = async () => {
    if (!hForm.name.trim()) return toast.error("Hospital name is required");
    setHSaving(true);
    try {
      if (hDialog.edit) {
        await api(`hospitals/${hDialog.edit.id}`, {
          method: "PUT",
          body: { ...hForm, is_active: hDialog.edit.is_active },
        });
        toast.success("Hospital updated");
      } else {
        await api("hospitals", { method: "POST", body: hForm });
        toast.success("Hospital created");
      }
      setHDialog({ open: false });
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setHSaving(false);
    }
  };

  const toggleHospitalActive = async (h: Hospital) => {
    try {
      await api(`hospitals/${h.id}`, {
        method: "PUT",
        body: {
          name: h.name, address: h.address, city: h.city, state: h.state,
          phone: h.phone, email: h.email, license_number: h.license_number,
          is_active: !h.is_active,
        },
      });
      toast.success(h.is_active ? "Hospital deactivated" : "Hospital activated");
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ---------- Admins ----------
  const openAdmin = (a?: AdminUser) => {
    setAForm(a ? {
      email: a.email || "", password: "", full_name: a.full_name || "",
      phone: a.phone || "", hospital_id: a.hospital_id,
    } : emptyAdmin);
    setADialog({ open: true, edit: a });
  };

  const saveAdmin = async () => {
    if (!aForm.hospital_id) return toast.error("Select a hospital");
    if (!aDialog.edit) {
      if (!aForm.email.trim() || !aForm.password) return toast.error("Email and password required");
      if (aForm.password.length < 6) return toast.error("Password must be at least 6 chars");
    }
    setASaving(true);
    try {
      if (aDialog.edit) {
        await api(`users/${aDialog.edit.id}`, {
          method: "PUT",
          body: {
            full_name: aForm.full_name,
            phone: aForm.phone,
            hospital_id: aForm.hospital_id,
          },
        });
        toast.success("Admin updated");
      } else {
        await api("users", {
          method: "POST",
          body: { ...aForm, role: "hospital_admin" },
        });
        toast.success("Admin created");
      }
      setADialog({ open: false });
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setASaving(false);
    }
  };

  const deleteAdmin = async (a: AdminUser) => {
    if (!confirm(`Delete admin ${a.email}? This removes their login permanently.`)) return;
    try {
      await api(`users/${a.id}`, { method: "DELETE" });
      toast.success("Admin deleted");
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetPassword = async () => {
    if (!pwDialog.admin) return;
    if (pwValue.length < 6) return toast.error("Password must be at least 6 chars");
    try {
      // super_admin path uses users/:id — but there is no password endpoint there.
      // Fall back to recreating via PATCH-like: call PUT with password field is not supported.
      // Use a dedicated call: admin-api/users/:id/password
      const { error } = await supabase.functions.invoke(`admin-api/users/${pwDialog.admin.id}/password`, {
        method: "POST",
        body: { password: pwValue },
      });
      if (error) throw error;
      toast.success("Password reset");
      setPwDialog({ open: false });
      setPwValue("");
    } catch (e: any) {
      toast.error(e.message || "Failed to reset password");
    }
  };

  const hospitalName = (id: string) => hospitals.find(h => h.id === id)?.name || "—";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold">Master Console</h1>
              <p className="text-xs text-muted-foreground">Super Admin · Manage hospitals & administrators</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Main App</Button>
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="hospitals">
          <TabsList>
            <TabsTrigger value="hospitals"><Building2 className="h-4 w-4 mr-1" /> Hospitals ({hospitals.length})</TabsTrigger>
            <TabsTrigger value="admins"><Users className="h-4 w-4 mr-1" /> Hospital Admins ({admins.length})</TabsTrigger>
          </TabsList>

          {/* HOSPITALS */}
          <TabsContent value="hospitals" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Hospitals</h2>
              <Button onClick={() => openHospital()}><Plus className="h-4 w-4 mr-1" /> Add Hospital</Button>
            </div>
            <div className="border border-border rounded-lg bg-card">
              {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : hospitals.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">No hospitals yet. Click "Add Hospital" to create one.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hospitals.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell>{h.city || "—"}{h.state ? `, ${h.state}` : ""}</TableCell>
                        <TableCell>{h.phone || "—"}</TableCell>
                        <TableCell>{h.license_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={h.is_active ? "default" : "secondary"}>
                            {h.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openHospital(h)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleHospitalActive(h)} title={h.is_active ? "Deactivate" : "Activate"}>
                            <Power className={`h-4 w-4 ${h.is_active ? "text-destructive" : "text-success"}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* ADMINS */}
          <TabsContent value="admins" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Hospital Administrators</h2>
              <Button onClick={() => openAdmin()} disabled={hospitals.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Add Admin
              </Button>
            </div>
            <div className="border border-border rounded-lg bg-card">
              {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : admins.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">No hospital admins yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.full_name || "—"}</TableCell>
                        <TableCell>{a.email}</TableCell>
                        <TableCell>{hospitalName(a.hospital_id)}</TableCell>
                        <TableCell>{a.phone || "—"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openAdmin(a)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setPwDialog({ open: true, admin: a }); setPwValue(""); }} title="Reset password">
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteAdmin(a)} title="Delete">
                            <Power className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Hospital Dialog */}
      <Dialog open={hDialog.open} onOpenChange={(open) => setHDialog({ open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{hDialog.edit ? "Edit Hospital" : "Add Hospital"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={hForm.name} onChange={(e) => setHForm({ ...hForm, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={hForm.address} onChange={(e) => setHForm({ ...hForm, address: e.target.value })} /></div>
            <div><Label>City</Label><Input value={hForm.city} onChange={(e) => setHForm({ ...hForm, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={hForm.state} onChange={(e) => setHForm({ ...hForm, state: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={hForm.phone} onChange={(e) => setHForm({ ...hForm, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={hForm.email} onChange={(e) => setHForm({ ...hForm, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>License Number</Label><Input value={hForm.license_number} onChange={(e) => setHForm({ ...hForm, license_number: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHDialog({ open: false })}>Cancel</Button>
            <Button onClick={saveHospital} disabled={hSaving}>
              {hSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <Dialog open={aDialog.open} onOpenChange={(open) => setADialog({ open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{aDialog.edit ? "Edit Admin" : "Add Hospital Admin"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Hospital *</Label>
              <Select value={aForm.hospital_id} onValueChange={(v) => setAForm({ ...aForm, hospital_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select hospital" /></SelectTrigger>
                <SelectContent>
                  {hospitals.filter(h => h.is_active).map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Full Name</Label><Input value={aForm.full_name} onChange={(e) => setAForm({ ...aForm, full_name: e.target.value })} /></div>
            <div>
              <Label>Email {!aDialog.edit && "*"}</Label>
              <Input type="email" disabled={!!aDialog.edit} value={aForm.email} onChange={(e) => setAForm({ ...aForm, email: e.target.value })} />
            </div>
            <div><Label>Phone</Label><Input value={aForm.phone} onChange={(e) => setAForm({ ...aForm, phone: e.target.value })} /></div>
            {!aDialog.edit && (
              <div className="col-span-2">
                <Label>Password *</Label>
                <Input type="text" value={aForm.password} onChange={(e) => setAForm({ ...aForm, password: e.target.value })} placeholder="min 6 chars" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setADialog({ open: false })}>Cancel</Button>
            <Button onClick={saveAdmin} disabled={aSaving}>
              {aSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset */}
      <Dialog open={pwDialog.open} onOpenChange={(open) => setPwDialog({ open })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{pwDialog.admin?.email}</p>
          <Input type="text" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="New password (min 6)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog({ open: false })}>Cancel</Button>
            <Button onClick={resetPassword}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}