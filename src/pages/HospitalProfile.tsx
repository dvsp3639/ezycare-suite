import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Save, Building2, Palette, FileSignature, ShieldCheck, Image as ImageIcon, Trash2 } from "lucide-react";

interface Branding {
  displayName?: string;
  tagline?: string;
  accentColor?: string;
  logoPath?: string;
  watermarkText?: string;
  letterheadPath?: string;
  letterhead?: { showHeader?: boolean; showFooter?: boolean; footerNote?: string };
}
interface Contact { address?: string; city?: string; state?: string; pincode?: string; phone?: string; email?: string; website?: string; supportEmail?: string; }
interface Compliance { licenseNumber?: string; gstin?: string; accreditation?: string[]; }
interface Signatures { pathologistName?: string; pathologistReg?: string; digitalSignatureUrl?: string; digitalSignaturePath?: string; }

const ACCREDITATIONS = ["NABL", "NABH", "ISO", "JCI", "CAP"];

const HospitalProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signInputRef = useRef<HTMLInputElement>(null);
  const letterheadInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "signature" | "letterhead" | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [branding, setBranding] = useState<Branding>({ accentColor: "#0d9488", letterhead: { showHeader: true, showFooter: true } });
  const [contact, setContact] = useState<Contact>({});
  const [compliance, setCompliance] = useState<Compliance>({ accreditation: [] });
  const [signatures, setSignatures] = useState<Signatures>({});
  const [published, setPublished] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [letterheadPreview, setLetterheadPreview] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["hospital-profile-editor", user?.id],
    queryFn: async () => {
      const { data: rolesRow } = await supabase.from("user_roles").select("hospital_id").eq("user_id", user!.id).not("hospital_id", "is", null).limit(1).maybeSingle();
      const hid = rolesRow?.hospital_id;
      if (!hid) return null;
      const [{ data: h }, { data: p }] = await Promise.all([
        supabase.from("hospitals").select("id,name,address,city,state,phone,email,license_number").eq("id", hid).maybeSingle(),
        supabase.from("hospital_profiles").select("*").eq("hospital_id", hid).maybeSingle(),
      ]);
      return { hospital: h, profile: p, hospitalId: hid };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!data) return;
    setHospitalId(data.hospitalId);
    setHospitalName(data.hospital?.name || "");
    const p: any = data.profile || {};
    const b: Branding = p.branding || {};
    setBranding({
      accentColor: "#0d9488",
      letterhead: { showHeader: true, showFooter: true },
      ...b,
      displayName: b.displayName || data.hospital?.name || "",
    });
    setContact({
      address: data.hospital?.address || "",
      city: data.hospital?.city || "",
      state: data.hospital?.state || "",
      phone: data.hospital?.phone || "",
      email: data.hospital?.email || "",
      ...(p.contact || {}),
    });
    setCompliance({
      licenseNumber: data.hospital?.license_number || "",
      accreditation: [],
      ...(p.compliance || {}),
    });
    setSignatures(p.signatures || {});
    setPublished(!!p.published);

    (async () => {
      if (b.logoPath) {
        const { data: s } = await supabase.storage.from("hospital-assets").createSignedUrl(b.logoPath, 3600);
        setLogoPreview(s?.signedUrl || "");
      }
      if (b.letterheadPath) {
        const { data: s } = await supabase.storage.from("hospital-assets").createSignedUrl(b.letterheadPath, 3600);
        setLetterheadPreview(s?.signedUrl || "");
      }
      const sigPath = (p.signatures || {}).digitalSignaturePath;
      if (sigPath) {
        const { data: s } = await supabase.storage.from("hospital-assets").createSignedUrl(sigPath, 3600);
        setSignaturePreview(s?.signedUrl || "");
      }
    })();
  }, [data]);

  const uploadAsset = async (file: File, kind: "logo" | "signature") => {
    if (!hospitalId) return null;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${hospitalId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("hospital-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("hospital-assets").createSignedUrl(path, 3600);
      return { path, url: signed?.signedUrl || "" };
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      return null;
    } finally { setUploading(null); }
  };

  const uploadLetterhead = async (file: File) => {
    if (!hospitalId) return null;
    setUploading("letterhead");
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${hospitalId}/letterhead-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("hospital-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("hospital-assets").createSignedUrl(path, 3600);
      return { path, url: signed?.signedUrl || "" };
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      return null;
    } finally { setUploading(null); }
  };

  const onLetterheadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const res = await uploadLetterhead(f);
    if (res) { setBranding((b) => ({ ...b, letterheadPath: res.path })); setLetterheadPreview(res.url); }
  };

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const res = await uploadAsset(f, "logo");
    if (res) { setBranding((b) => ({ ...b, logoPath: res.path })); setLogoPreview(res.url); }
  };
  const onSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const res = await uploadAsset(f, "signature");
    if (res) { setSignatures((s) => ({ ...s, digitalSignaturePath: res.path })); setSignaturePreview(res.url); }
  };

  const toggleAccreditation = (label: string) => {
    setCompliance((c) => {
      const list = new Set(c.accreditation || []);
      list.has(label) ? list.delete(label) : list.add(label);
      return { ...c, accreditation: Array.from(list) };
    });
  };

  const handleSave = async () => {
    if (!hospitalId) return;
    setSaving(true);
    try {
      // Update hospitals table base fields
      await supabase.from("hospitals").update({
        name: branding.displayName || hospitalName,
        address: contact.address || null,
        city: contact.city || null,
        state: contact.state || null,
        phone: contact.phone || null,
        email: contact.email || null,
        license_number: compliance.licenseNumber || null,
      }).eq("id", hospitalId);

      // Upsert hospital_profiles
      const payload: any = {
        hospital_id: hospitalId,
        branding: branding as any,
        contact: contact as any,
        compliance: compliance as any,
        signatures: signatures as any,
        published,
        updated_by: user?.id,
      };
      const existingId = (data as any)?.profile?.id;
      const { error } = existingId
        ? await supabase.from("hospital_profiles").update(payload).eq("id", existingId)
        : await supabase.from("hospital_profiles").insert(payload);
      if (error) throw error;
      toast({ title: "Hospital profile saved", description: "Branding will apply to reports and receipts." });
      qc.invalidateQueries({ queryKey: ["hospital-profile"] });
      qc.invalidateQueries({ queryKey: ["hospital-profile-editor"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!hospitalId) return <div className="p-8 text-muted-foreground">No hospital associated with this admin account.</div>;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Hospital Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Enterprise branding, letterhead, compliance & signatures — applied across reports, receipts and dashboards.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={published} onCheckedChange={setPublished} id="pub" />
            <Label htmlFor="pub">Public listing</Label>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="basic"><Building2 className="h-4 w-4 mr-1" /> Basic</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 mr-1" /> Branding</TabsTrigger>
          <TabsTrigger value="compliance"><ShieldCheck className="h-4 w-4 mr-1" /> Compliance</TabsTrigger>
          <TabsTrigger value="signatures"><FileSignature className="h-4 w-4 mr-1" /> Signatures</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Hospital Information</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div><Label>Display Name *</Label><Input value={branding.displayName || ""} onChange={(e) => setBranding({ ...branding, displayName: e.target.value })} /></div>
              <div><Label>Tagline</Label><Input placeholder="e.g. Care that heals" value={branding.tagline || ""} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={contact.address || ""} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></div>
              <div><Label>City</Label><Input value={contact.city || ""} onChange={(e) => setContact({ ...contact, city: e.target.value })} /></div>
              <div><Label>State</Label><Input value={contact.state || ""} onChange={(e) => setContact({ ...contact, state: e.target.value })} /></div>
              <div><Label>Pincode</Label><Input value={contact.pincode || ""} onChange={(e) => setContact({ ...contact, pincode: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={contact.phone || ""} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={contact.email || ""} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={contact.website || ""} onChange={(e) => setContact({ ...contact, website: e.target.value })} /></div>
              <div><Label>Patient Support Email</Label><Input value={contact.supportEmail || ""} onChange={(e) => setContact({ ...contact, supportEmail: e.target.value })} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Logo & Colors</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                  {logoPreview ? <img src={logoPreview} alt="Hospital logo" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                  <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploading === "logo"} className="gap-2">
                    {uploading === "logo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Logo
                  </Button>
                  {branding.logoPath && (
                    <Button variant="ghost" size="sm" onClick={() => { setBranding({ ...branding, logoPath: undefined }); setLogoPreview(""); }} className="gap-1 text-destructive">
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Recommended: 512×512 PNG, transparent background.</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Accent Color</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={branding.accentColor || "#0d9488"} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} className="h-10 w-16 rounded border" />
                    <Input value={branding.accentColor || ""} onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Watermark Text (reports)</Label>
                  <Input placeholder="e.g. ORIGINAL" value={branding.watermarkText || ""} onChange={(e) => setBranding({ ...branding, watermarkText: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Letterhead</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Pre-designed Letterhead Image (optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">If uploaded, it will replace the text-based header on OP receipts, prescriptions, pharmacy bills, diagnostic reports and discharge summaries. Recommended: 1240 × 260 PNG/JPG.</p>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-64 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                    {letterheadPreview ? <img src={letterheadPreview} alt="Letterhead" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="space-y-2">
                    <input ref={letterheadInputRef} type="file" accept="image/*" className="hidden" onChange={onLetterheadChange} />
                    <Button variant="outline" onClick={() => letterheadInputRef.current?.click()} disabled={uploading === "letterhead"} className="gap-2">
                      {uploading === "letterhead" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Letterhead
                    </Button>
                    {branding.letterheadPath && (
                      <Button variant="ghost" size="sm" onClick={() => { setBranding({ ...branding, letterheadPath: undefined }); setLetterheadPreview(""); }} className="gap-1 text-destructive">
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between"><Label>Show branded header on reports</Label>
                <Switch checked={!!branding.letterhead?.showHeader} onCheckedChange={(v) => setBranding({ ...branding, letterhead: { ...branding.letterhead, showHeader: v } })} />
              </div>
              <div className="flex items-center justify-between"><Label>Show footer on reports & receipts</Label>
                <Switch checked={!!branding.letterhead?.showFooter} onCheckedChange={(v) => setBranding({ ...branding, letterhead: { ...branding.letterhead, showFooter: v } })} />
              </div>
              <div><Label>Footer note</Label><Textarea rows={2} placeholder="This is a computer-generated document…" value={branding.letterhead?.footerNote || ""} onChange={(e) => setBranding({ ...branding, letterhead: { ...branding.letterhead, footerNote: e.target.value } })} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">License & Tax</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div><Label>Hospital License Number</Label><Input value={compliance.licenseNumber || ""} onChange={(e) => setCompliance({ ...compliance, licenseNumber: e.target.value })} /></div>
              <div><Label>GSTIN</Label><Input value={compliance.gstin || ""} onChange={(e) => setCompliance({ ...compliance, gstin: e.target.value })} /></div>
              <div className="md:col-span-2">
                <Label>Accreditations</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {ACCREDITATIONS.map((a) => {
                    const active = compliance.accreditation?.includes(a);
                    return (
                      <Badge key={a} variant={active ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleAccreditation(a)}>{a}</Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signatures" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Pathologist / Authorized Signatory</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={signatures.pathologistName || ""} onChange={(e) => setSignatures({ ...signatures, pathologistName: e.target.value })} /></div>
                <div><Label>Registration No.</Label><Input value={signatures.pathologistReg || ""} onChange={(e) => setSignatures({ ...signatures, pathologistReg: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-40 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 overflow-hidden">
                  {signaturePreview ? <img src={signaturePreview} alt="Signature" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-muted-foreground">No signature</span>}
                </div>
                <div className="space-y-2">
                  <input ref={signInputRef} type="file" accept="image/*" className="hidden" onChange={onSignatureChange} />
                  <Button variant="outline" onClick={() => signInputRef.current?.click()} disabled={uploading === "signature"} className="gap-2">
                    {uploading === "signature" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Signature
                  </Button>
                  <p className="text-xs text-muted-foreground">Transparent PNG preferred.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HospitalProfilePage;