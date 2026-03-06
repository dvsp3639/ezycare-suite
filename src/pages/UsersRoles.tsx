import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Users, Search, KeyRound } from "lucide-react";

const ROLES = [
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "receptionist", label: "Receptionist" },
];

const ROLE_COLORS: Record<string, string> = {
  doctor: "bg-primary/10 text-primary border-primary/20",
  nurse: "bg-info/10 text-info border-info/20",
  lab_technician: "bg-warning/10 text-warning border-warning/20",
  pharmacist: "bg-success/10 text-success border-success/20",
  receptionist: "bg-accent text-accent-foreground border-accent",
};

interface StaffUser {
  id: string;
  user_id: string;
  role: string;
  hospital_id: string;
  email: string;
  full_name: string;
  phone: string;
}

interface FormData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
}

const emptyForm: FormData = { email: "", password: "", full_name: "", phone: "", role: "" };

export default function UsersRoles() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPwDialogOpen, setResetPwDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<StaffUser | null>(null);
  const [resetPwUser, setResetPwUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState<FormData>(emptyForm);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [search, setSearch] = useState("");

  const apiCall = useCallback(async (path: string, method: string, body?: any) => {
    const opts: any = {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      method,
    };
    if (body) opts.body = body;

    const { data, error } = await supabase.functions.invoke(`admin-api/${path}`, opts);
    if (error) throw new Error(error.message || "API error");
    if (data?.error) throw new Error(data.error);
    return data;
  }, [session]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const roleParam = filterRole !== "all" ? `?role=${filterRole}` : "";
      const data = await apiCall(`hospital-users${roleParam}`, "GET");
      setUsers(data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [apiCall, filterRole, toast]);

  useEffect(() => {
    if (session) fetchUsers();
  }, [session, fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: StaffUser) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      full_name: user.full_name || "",
      phone: user.phone || "",
      role: user.role,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        await apiCall(`hospital-users/${editingUser.id}`, "PUT", {
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
        });
        toast({ title: "Updated", description: "User updated successfully" });
      } else {
        if (!form.email || !form.password || !form.role) {
          toast({ title: "Error", description: "Email, password and role are required", variant: "destructive" });
          setSaving(false);
          return;
        }
        await apiCall("hospital-users", "POST", form);
        toast({ title: "Created", description: "User created successfully" });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setSaving(true);
    try {
      await apiCall(`hospital-users/${deletingUser.id}`, "DELETE");
      toast({ title: "Deleted", description: "User removed successfully" });
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiCall(`hospital-users/${resetPwUser.id}`, "PATCH", { password: newPassword });
      toast({ title: "Success", description: "Password reset successfully" });
      setResetPwDialogOpen(false);
      setResetPwUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  const getRoleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label || role;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage your hospital staff credentials</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ROLES.map((r) => {
          const count = users.filter((u) => u.role === r.value).length;
          return (
            <Card key={r.value} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setFilterRole(filterRole === r.value ? "all" : r.value)}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{r.label}s</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Staff Members ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No staff members found</p>
              <Button variant="outline" className="mt-3" onClick={openCreate}>Add your first user</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[user.role] || ""}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => { setDeletingUser(user); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} disabled={!!editingUser}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deletingUser?.full_name || deletingUser?.email}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
