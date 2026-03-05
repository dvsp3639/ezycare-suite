import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, Plus, Trash2, LogOut, BarChart3,
  Loader2, Activity, Edit, Power, PowerOff
} from "lucide-react";
import ezyopIcon from "@/assets/ezyop-icon.png";

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

interface HospitalAdmin {
  id: string;
  user_id: string;
  role: string;
  hospital_id: string;
  email?: string;
  full_name?: string;
  phone?: string;
}

interface Analytics {
  total_hospitals: number;
  active_hospitals: number;
  total_admins: number;
  recent_hospitals: any[];
}

const callApi = async (path: string, method = "GET", body?: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke(`admin-api/${path}`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: body ? body : undefined,
  });

  if (error) throw error;
  return data;
};

const SuperAdminDashboard = () => {
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [admins, setAdmins] = useState<HospitalAdmin[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Hospital dialog
  const [showHospitalDialog, setShowHospitalDialog] = useState(false);
  const [editHospital, setEditHospital] = useState<Hospital | null>(null);
  const [hospitalForm, setHospitalForm] = useState({
    name: "", address: "", city: "", state: "", phone: "", email: "", license_number: ""
  });

  // Admin dialog
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminForm, setAdminForm] = useState({
    email: "", password: "", full_name: "", phone: "", hospital_id: ""
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [hospitalsData, adminsData, analyticsData] = await Promise.all([
        callApi("hospitals"),
        callApi("hospital-admins"),
        callApi("analytics"),
      ]);
      setHospitals(hospitalsData || []);
      setAdmins(adminsData || []);
      setAnalytics(analyticsData);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveHospital = async () => {
    try {
      if (editHospital) {
        await callApi(`hospitals/${editHospital.id}`, "PUT", hospitalForm);
        toast({ title: "Hospital updated" });
      } else {
        await callApi("hospitals", "POST", hospitalForm);
        toast({ title: "Hospital created" });
      }
      setShowHospitalDialog(false);
      setEditHospital(null);
      setHospitalForm({ name: "", address: "", city: "", state: "", phone: "", email: "", license_number: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteHospital = async (id: string) => {
    if (!confirm("Delete this hospital and all its data?")) return;
    try {
      await callApi(`hospitals/${id}`, "DELETE");
      toast({ title: "Hospital deleted" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleHospital = async (hospital: Hospital) => {
    try {
      await callApi(`hospitals/${hospital.id}`, "PUT", { ...hospital, is_active: !hospital.is_active });
      toast({ title: hospital.is_active ? "Hospital deactivated" : "Hospital activated" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateAdmin = async () => {
    try {
      await callApi("hospital-admins", "POST", adminForm);
      toast({ title: "Admin created successfully" });
      setShowAdminDialog(false);
      setAdminForm({ email: "", password: "", full_name: "", phone: "", hospital_id: "" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (!confirm("Remove this admin? Their account will be deleted.")) return;
    try {
      await callApi(`hospital-admins/${id}`, "DELETE");
      toast({ title: "Admin removed" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openEditHospital = (h: Hospital) => {
    setEditHospital(h);
    setHospitalForm({
      name: h.name, address: h.address || "", city: h.city || "",
      state: h.state || "", phone: h.phone || "", email: h.email || "",
      license_number: h.license_number || "",
    });
    setShowHospitalDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ezyopIcon} alt="EZY OP" className="w-8 h-8 rounded-md" />
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">
              Ezy<span className="text-primary">op</span> Super Admin
            </h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </header>

      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="hospitals"><Building2 className="h-4 w-4 mr-2" />Hospitals</TabsTrigger>
            <TabsTrigger value="admins"><Users className="h-4 w-4 mr-2" />Admins</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Hospitals</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-foreground">{analytics?.total_hospitals}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Hospitals</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-success">{analytics?.active_hospitals}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Admins</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-primary">{analytics?.total_admins}</p></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Recently Added Hospitals</CardTitle></CardHeader>
              <CardContent>
                {analytics?.recent_hospitals?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.recent_hospitals.map((h: any) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium">{h.name}</TableCell>
                          <TableCell>{h.city || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={h.is_active ? "default" : "secondary"}>
                              {h.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(h.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm py-4 text-center">No hospitals yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HOSPITALS */}
          <TabsContent value="hospitals">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">Hospitals</h2>
              <Button onClick={() => { setEditHospital(null); setHospitalForm({ name: "", address: "", city: "", state: "", phone: "", email: "", license_number: "" }); setShowHospitalDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Hospital
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
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
                        <TableCell>{h.city || "—"}</TableCell>
                        <TableCell>{h.phone || "—"}</TableCell>
                        <TableCell>{h.license_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={h.is_active ? "default" : "secondary"}>
                            {h.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEditHospital(h)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleHospital(h)}>
                              {h.is_active ? <PowerOff className="h-4 w-4 text-warning" /> : <Power className="h-4 w-4 text-success" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteHospital(h.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!hospitals.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No hospitals added yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADMINS */}
          <TabsContent value="admins">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-foreground">Hospital Admins</h2>
              <Button onClick={() => setShowAdminDialog(true)} disabled={!hospitals.length}>
                <Plus className="h-4 w-4 mr-2" /> Create Admin
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.full_name || "—"}</TableCell>
                        <TableCell>{a.email || "—"}</TableCell>
                        <TableCell>{a.phone || "—"}</TableCell>
                        <TableCell>
                          {hospitals.find(h => h.id === a.hospital_id)?.name || a.hospital_id}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAdmin(a.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!admins.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No admins created yet. Add a hospital first, then create an admin.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hospital Dialog */}
      <Dialog open={showHospitalDialog} onOpenChange={setShowHospitalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editHospital ? "Edit Hospital" : "Add Hospital"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Hospital Name *</Label><Input value={hospitalForm.name} onChange={e => setHospitalForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label><Input value={hospitalForm.city} onChange={e => setHospitalForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={hospitalForm.state} onChange={e => setHospitalForm(p => ({ ...p, state: e.target.value }))} /></div>
            </div>
            <div><Label>Address</Label><Input value={hospitalForm.address} onChange={e => setHospitalForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={hospitalForm.phone} onChange={e => setHospitalForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={hospitalForm.email} onChange={e => setHospitalForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label>License Number</Label><Input value={hospitalForm.license_number} onChange={e => setHospitalForm(p => ({ ...p, license_number: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHospitalDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveHospital} disabled={!hospitalForm.name}>{editHospital ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Hospital Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Hospital *</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={adminForm.hospital_id}
                onChange={e => setAdminForm(p => ({ ...p, hospital_id: e.target.value }))}
              >
                <option value="">Select hospital...</option>
                {hospitals.filter(h => h.is_active).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div><Label>Full Name *</Label><Input value={adminForm.full_name} onChange={e => setAdminForm(p => ({ ...p, full_name: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input type="email" value={adminForm.email} onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Password *</Label><Input type="password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={adminForm.phone} onChange={e => setAdminForm(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdminDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={!adminForm.email || !adminForm.password || !adminForm.hospital_id}>
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
