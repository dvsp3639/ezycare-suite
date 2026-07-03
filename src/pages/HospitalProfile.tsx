import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Building2, Palette, Images, Layers, Stethoscope, Sparkles,
  FileText, PenTool, Smartphone, Link as LinkIcon, ShieldCheck, Eye,
  Upload, Trash2, Plus, Loader2, Save, Star, CheckCircle2,
} from "lucide-react";

const BUCKET = "hospital-assets";

const FACILITY_CATALOG = [
  "24×7 Emergency","Laboratory","Pharmacy","Ambulance","Parking","Lift","Wheelchair",
  "Blood Bank","MRI","CT Scan","X-Ray","Ultrasound","Insurance","NABH","Cashless",
  "Cafeteria","Wi-Fi","ATM",
];
const DEFAULT_DEPARTMENTS = [
  "General Medicine","Orthopaedics","Cardiology","ENT","Paediatrics","Neurology",
  "Gynaecology","Dermatology","Urology","Ophthalmology","Dental","Physiotherapy",
];
const GALLERY_CATEGORIES = [
  "Hospital Exterior","Entrance","Reception","Waiting Hall","Consultation Rooms",
  "Doctors","Operation Theatre","ICU","Emergency","Laboratory","Pharmacy","Parking",
  "Wheelchair Access","Cafeteria","Patient Waiting Area","Hospital Premises","Hospital Events",
];
const DOC_TEMPLATES = [
  { key: "letterhead", label: "Official Letterhead" },
  { key: "prescription", label: "Prescription Template" },
  { key: "opReceipt", label: "OP Receipt Template" },
  { key: "pharmacyBill", label: "Pharmacy Bill Template" },
  { key: "labReport", label: "Lab Report Template" },
  { key: "radiologyReport", label: "Radiology Report Template" },
  { key: "dischargeSummary", label: "Discharge Summary" },
  { key: "medicalCertificate", label: "Medical Certificate" },
  { key: "referralLetter", label: "Referral Letter" },
  { key: "consentForms", label: "Consent Forms" },
  { key: "estimate", label: "Estimate Template" },
  { key: "paymentReceipt", label: "Payment Receipt Template" },
];
const SIGNATURE_ROLES = [
  { key: "hospitalSeal", label: "Hospital Seal" },
  { key: "medicalSuperintendent", label: "Medical Superintendent" },
  { key: "pharmacist", label: "Pharmacist" },
  { key: "labHead", label: "Laboratory Head" },
  { key: "administrator", label: "Administrator" },
];
const COMPLIANCE_ITEMS = [
  "Hospital Registration","NABH","NABL","Fire Safety","Pollution",
  "Clinical Establishment License","Drug License","Insurance Empanelment",
];

type Profile = {
  id?: string;
  hospital_id: string;
  basic: any;
  branding: any;
  gallery: any[];
  departments: any[];
  doctors: any[];
  facilities: string[];
  documents: Record<string, any>;
  signatures: Record<string, any>;
  patient_app: any;
  contact: any;
  compliance: any[];
  published: boolean;
};

const emptyProfile = (hospital_id: string): Profile => ({
  hospital_id,
  basic: {},
  branding: {},
  gallery: [],
  departments: DEFAULT_DEPARTMENTS.map((n) => ({ name: n, active: true })),
  doctors: [],
  facilities: [],
  documents: {},
  signatures: {},
  patient_app: {},
  contact: {},
  compliance: COMPLIANCE_ITEMS.map((n) => ({ name: n, number: "", expiry: "" })),
  published: false,
});

async function uploadAsset(hospitalId: string, folder: string, file: File): Promise<{ path: string; url: string }> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${hospitalId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  return { path, url: data?.signedUrl || "" };
}

export default function HospitalProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hospitalId, setHospitalId] = useState<string>("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState("basic");

  useEffect(() => {
    (async () => {
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("hospital_id")
          .eq("user_id", user!.id)
          .not("hospital_id", "is", null)
          .limit(1)
          .maybeSingle();
        const hid = roles?.hospital_id as string;
        if (!hid) { toast.error("No hospital linked to your account"); setLoading(false); return; }
        setHospitalId(hid);
        const { data } = await supabase
          .from("hospital_profiles").select("*").eq("hospital_id", hid).maybeSingle();
        if (data) setProfile(data as any);
        else setProfile(emptyProfile(hid));
      } finally { setLoading(false); }
    })();
  }, [user]);

  const patch = (key: keyof Profile, value: any) =>
    setProfile((p) => (p ? { ...p, [key]: value } : p));

  const save = async (publish = false) => {
    if (!profile) return;
    setSaving(true);
    try {
      const payload = { ...profile, published: publish ? true : profile.published, updated_by: user!.id };
      const { data, error } = await supabase
        .from("hospital_profiles")
        .upsert(payload, { onConflict: "hospital_id" })
        .select().single();
      if (error) throw error;
      setProfile(data as any);
      toast.success(publish ? "Published successfully" : "Saved");
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  if (loading || !profile) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto w-full space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> Hospital Profile & Digital Assets
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Master source for hospital info reused across HMS & Patient App</p>
        </div>
        <div className="flex items-center gap-2">
          {profile.published ? (
            <Badge className="bg-success/15 text-success border-success/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Published</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            <Sparkles className="h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="h-auto flex flex-wrap justify-start gap-1 bg-muted/50 p-1">
            <TabsTrigger value="basic"><Building2 className="h-3.5 w-3.5 mr-1.5" />Basic</TabsTrigger>
            <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5 mr-1.5" />Branding</TabsTrigger>
            <TabsTrigger value="gallery"><Images className="h-3.5 w-3.5 mr-1.5" />Gallery</TabsTrigger>
            <TabsTrigger value="departments"><Layers className="h-3.5 w-3.5 mr-1.5" />Departments</TabsTrigger>
            <TabsTrigger value="doctors"><Stethoscope className="h-3.5 w-3.5 mr-1.5" />Doctors</TabsTrigger>
            <TabsTrigger value="facilities"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Facilities</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" />Documents</TabsTrigger>
            <TabsTrigger value="signatures"><PenTool className="h-3.5 w-3.5 mr-1.5" />Signatures</TabsTrigger>
            <TabsTrigger value="app"><Smartphone className="h-3.5 w-3.5 mr-1.5" />Patient App</TabsTrigger>
            <TabsTrigger value="contact"><LinkIcon className="h-3.5 w-3.5 mr-1.5" />Contact</TabsTrigger>
            <TabsTrigger value="compliance"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Compliance</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="basic"><BasicTab profile={profile} patch={patch} /></TabsContent>
        <TabsContent value="branding"><BrandingTab profile={profile} patch={patch} hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="gallery"><GalleryTab profile={profile} patch={patch} hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab profile={profile} patch={patch} /></TabsContent>
        <TabsContent value="doctors"><DoctorsTab profile={profile} patch={patch} hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="facilities"><FacilitiesTab profile={profile} patch={patch} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab profile={profile} patch={patch} hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="signatures"><SignaturesTab profile={profile} patch={patch} hospitalId={hospitalId} /></TabsContent>
        <TabsContent value="app"><PatientAppTab profile={profile} patch={patch} /></TabsContent>
        <TabsContent value="contact"><ContactTab profile={profile} patch={patch} /></TabsContent>
        <TabsContent value="compliance"><ComplianceTab profile={profile} patch={patch} /></TabsContent>
        <TabsContent value="preview"><PreviewTab profile={profile} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AssetUploader({
  label, value, hospitalId, folder, accept = "image/*", onChange,
}: {
  label: string; value?: { url?: string; path?: string }; hospitalId: string; folder: string; accept?: string;
  onChange: (v: { url: string; path: string } | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="border-2 border-dashed rounded-xl p-4 flex items-center gap-3 bg-muted/30">
        {value?.url ? (
          <img src={value.url} alt={label} className="h-16 w-16 object-contain bg-white rounded-lg border" />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-background border flex items-center justify-center text-muted-foreground">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <input
            type="file" accept={accept} disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setBusy(true);
              try { const r = await uploadAsset(hospitalId, folder, f); onChange(r); toast.success(`${label} uploaded`); }
              catch (err: any) { toast.error(err?.message || "Upload failed"); }
              finally { setBusy(false); e.currentTarget.value = ""; }
            }}
            className="text-xs"
          />
          {value?.url && (
            <Button size="sm" variant="ghost" className="mt-1 h-7 text-xs" onClick={() => onChange(null)}>
              <Trash2 className="h-3 w-3" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- tabs ---------- */

function BasicTab({ profile, patch }: any) {
  const b = profile.basic || {};
  const set = (k: string, v: any) => patch("basic", { ...b, [k]: v });
  return (
    <Card><CardHeader><CardTitle>Basic Information</CardTitle><CardDescription>Core hospital identity used everywhere</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Hospital Name"><Input value={b.name||""} onChange={(e)=>set("name",e.target.value)} /></Field>
        <Field label="Hospital Type"><Input placeholder="Multi-speciality / Clinic / Nursing Home" value={b.type||""} onChange={(e)=>set("type",e.target.value)} /></Field>
        <Field label="Registration Number"><Input value={b.registrationNo||""} onChange={(e)=>set("registrationNo",e.target.value)} /></Field>
        <Field label="GST Number"><Input value={b.gst||""} onChange={(e)=>set("gst",e.target.value)} /></Field>
        <Field label="Year Established"><Input type="number" value={b.year||""} onChange={(e)=>set("year",e.target.value)} /></Field>
        <Field label="Reception Number"><Input value={b.reception||""} onChange={(e)=>set("reception",e.target.value)} /></Field>
        <Field label="Emergency Contact"><Input value={b.emergency||""} onChange={(e)=>set("emergency",e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={b.email||""} onChange={(e)=>set("email",e.target.value)} /></Field>
        <Field label="Website"><Input value={b.website||""} onChange={(e)=>set("website",e.target.value)} /></Field>
        <div className="md:col-span-2 lg:col-span-3"><Field label="Address"><Textarea rows={2} value={b.address||""} onChange={(e)=>set("address",e.target.value)} /></Field></div>
        <Field label="City"><Input value={b.city||""} onChange={(e)=>set("city",e.target.value)} /></Field>
        <Field label="State"><Input value={b.state||""} onChange={(e)=>set("state",e.target.value)} /></Field>
        <Field label="Pincode"><Input value={b.pincode||""} onChange={(e)=>set("pincode",e.target.value)} /></Field>
        <Field label="Latitude"><Input value={b.lat||""} onChange={(e)=>set("lat",e.target.value)} /></Field>
        <Field label="Longitude"><Input value={b.lng||""} onChange={(e)=>set("lng",e.target.value)} /></Field>
        <Field label="Google Map URL"><Input value={b.mapUrl||""} onChange={(e)=>set("mapUrl",e.target.value)} /></Field>
        <Field label="Working Hours"><Input placeholder="Mon–Sat 8:00 AM – 9:00 PM" value={b.hours||""} onChange={(e)=>set("hours",e.target.value)} /></Field>
        <Field label="Languages Supported"><Input placeholder="English, Hindi, Telugu" value={b.languages||""} onChange={(e)=>set("languages",e.target.value)} /></Field>
        <div className="md:col-span-2 lg:col-span-3"><Field label="Hospital Description"><Textarea rows={3} value={b.description||""} onChange={(e)=>set("description",e.target.value)} /></Field></div>
        <div className="md:col-span-2 lg:col-span-3 grid md:grid-cols-2 gap-4">
          <Field label="Vision"><Textarea rows={3} value={b.vision||""} onChange={(e)=>set("vision",e.target.value)} /></Field>
          <Field label="Mission"><Textarea rows={3} value={b.mission||""} onChange={(e)=>set("mission",e.target.value)} /></Field>
        </div>
      </CardContent>
    </Card>
  );
}

function BrandingTab({ profile, patch, hospitalId }: any) {
  const br = profile.branding || {};
  const set = (k: string, v: any) => patch("branding", { ...br, [k]: v });
  return (
    <Card><CardHeader><CardTitle>Branding</CardTitle><CardDescription>Logos, colors and tagline reused on receipts, reports and app</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AssetUploader label="Primary Logo" hospitalId={hospitalId} folder="branding" value={br.primaryLogo} onChange={(v)=>set("primaryLogo",v)} />
        <AssetUploader label="Dark Logo" hospitalId={hospitalId} folder="branding" value={br.darkLogo} onChange={(v)=>set("darkLogo",v)} />
        <AssetUploader label="Favicon" hospitalId={hospitalId} folder="branding" value={br.favicon} onChange={(v)=>set("favicon",v)} />
        <AssetUploader label="Hospital Cover Banner" hospitalId={hospitalId} folder="branding" value={br.banner} onChange={(v)=>set("banner",v)} />
        <Field label="Brand Color"><div className="flex gap-2"><Input type="color" value={br.primaryColor||"#7c3aed"} onChange={(e)=>set("primaryColor",e.target.value)} className="w-16 h-10 p-1" /><Input value={br.primaryColor||""} onChange={(e)=>set("primaryColor",e.target.value)} /></div></Field>
        <Field label="Secondary Color"><div className="flex gap-2"><Input type="color" value={br.secondaryColor||"#0ea5e9"} onChange={(e)=>set("secondaryColor",e.target.value)} className="w-16 h-10 p-1" /><Input value={br.secondaryColor||""} onChange={(e)=>set("secondaryColor",e.target.value)} /></div></Field>
        <div className="md:col-span-2"><Field label="Hospital Tagline"><Input value={br.tagline||""} onChange={(e)=>set("tagline",e.target.value)} placeholder="Caring for life" /></Field></div>
        <div className="md:col-span-2 rounded-xl border p-5 bg-gradient-to-br" style={{ backgroundImage: `linear-gradient(135deg, ${br.primaryColor||"#7c3aed"}22, ${br.secondaryColor||"#0ea5e9"}22)` }}>
          <div className="flex items-center gap-3">
            {br.primaryLogo?.url && <img src={br.primaryLogo.url} alt="logo" className="h-12 object-contain" />}
            <div>
              <div className="font-bold text-lg">{profile.basic?.name || "Your Hospital"}</div>
              <div className="text-xs text-muted-foreground">{br.tagline || "Tagline preview"}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GalleryTab({ profile, patch, hospitalId }: any) {
  const gallery: any[] = profile.gallery || [];
  const [cat, setCat] = useState(GALLERY_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      const uploaded: any[] = [];
      for (const f of Array.from(files)) {
        const r = await uploadAsset(hospitalId, `gallery/${cat}`, f);
        uploaded.push({ id: crypto.randomUUID(), category: cat, ...r, cover: false });
      }
      patch("gallery", [...gallery, ...uploaded]);
      toast.success(`${uploaded.length} image(s) added`);
    } catch (e: any) { toast.error(e?.message || "Upload failed"); }
    finally { setBusy(false); }
  };

  const setCover = (id: string) => patch("gallery", gallery.map((g) => ({ ...g, cover: g.id === id })));
  const del = (id: string) => patch("gallery", gallery.filter((g) => g.id !== id));

  return (
    <Card><CardHeader><CardTitle>Hospital Gallery</CardTitle><CardDescription>Categorized images shown in the Patient App</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
          <Field label="Category">
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={cat} onChange={(e)=>setCat(e.target.value)}>
              {GALLERY_CATEGORIES.map((c)=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <label className="flex-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors">
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e)=>addFiles(e.target.files)} />
            <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-sm">{busy ? "Uploading…" : "Drag & drop or click to add images"}</div>
          </label>
        </div>
        {GALLERY_CATEGORIES.map((c) => {
          const items = gallery.filter((g) => g.category === c);
          if (!items.length) return null;
          return (
            <div key={c}>
              <div className="text-sm font-semibold mb-2">{c} <Badge variant="outline" className="ml-1">{items.length}</Badge></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {items.map((g) => (
                  <div key={g.id} className="relative group aspect-square rounded-lg overflow-hidden border">
                    <img src={g.url} alt="" className="w-full h-full object-cover" />
                    {g.cover && <Badge className="absolute top-1 left-1 text-[10px]">Cover</Badge>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                      <Button size="icon" variant="secondary" className="h-7 w-7" onClick={()=>setCover(g.id)}><Star className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="destructive" className="h-7 w-7" onClick={()=>del(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DepartmentsTab({ profile, patch }: any) {
  const deps: any[] = profile.departments || [];
  const [name, setName] = useState("");
  const toggle = (i: number) => patch("departments", deps.map((d, idx) => idx===i?{...d, active: !d.active}:d));
  const remove = (i: number) => patch("departments", deps.filter((_,idx)=>idx!==i));
  const add = () => { if (!name.trim()) return; patch("departments", [...deps, { name: name.trim(), active: true }]); setName(""); };
  return (
    <Card><CardHeader><CardTitle>Departments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Add custom department" value={name} onChange={(e)=>setName(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&add()} />
          <Button onClick={add}><Plus className="h-4 w-4" />Add</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {deps.map((d, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3 bg-card">
              <div className="flex items-center gap-2"><Switch checked={d.active} onCheckedChange={()=>toggle(i)} /><span className={d.active?"font-medium":"text-muted-foreground line-through"}>{d.name}</span></div>
              <Button size="icon" variant="ghost" onClick={()=>remove(i)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DoctorsTab({ profile, patch, hospitalId }: any) {
  const doctors: any[] = profile.doctors || [];
  const upd = (i: number, k: string, v: any) => patch("doctors", doctors.map((d,idx)=>idx===i?{...d,[k]:v}:d));
  const add = () => patch("doctors", [...doctors, { id: crypto.randomUUID(), name: "", specialization: "", bookable: true, visible: true }]);
  const del = (i: number) => patch("doctors", doctors.filter((_,idx)=>idx!==i));
  return (
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Doctors</CardTitle><Button onClick={add}><Plus className="h-4 w-4" />Add Doctor</Button></CardHeader>
      <CardContent className="space-y-4">
        {doctors.length===0 && <p className="text-sm text-muted-foreground text-center py-8">No doctors added yet</p>}
        {doctors.map((d, i) => (
          <div key={d.id} className="rounded-xl border p-4 space-y-3 bg-card">
            <div className="flex justify-between items-start">
              <div className="font-semibold">{d.name || `Doctor #${i+1}`}</div>
              <Button size="icon" variant="ghost" onClick={()=>del(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <AssetUploader label="Photo" hospitalId={hospitalId} folder={`doctors/${d.id}`} value={d.photo} onChange={(v)=>upd(i,"photo",v)} />
              <AssetUploader label="Signature" hospitalId={hospitalId} folder={`doctors/${d.id}`} value={d.signature} onChange={(v)=>upd(i,"signature",v)} />
              <Field label="Name"><Input value={d.name||""} onChange={(e)=>upd(i,"name",e.target.value)} /></Field>
              <Field label="Qualification"><Input value={d.qualification||""} onChange={(e)=>upd(i,"qualification",e.target.value)} /></Field>
              <Field label="Specialization"><Input value={d.specialization||""} onChange={(e)=>upd(i,"specialization",e.target.value)} /></Field>
              <Field label="Experience (years)"><Input value={d.experience||""} onChange={(e)=>upd(i,"experience",e.target.value)} /></Field>
              <Field label="Medical Registration No"><Input value={d.regNo||""} onChange={(e)=>upd(i,"regNo",e.target.value)} /></Field>
              <Field label="Languages"><Input value={d.languages||""} onChange={(e)=>upd(i,"languages",e.target.value)} /></Field>
              <Field label="Availability"><Input placeholder="Mon–Sat 10:00 AM – 1:00 PM" value={d.availability||""} onChange={(e)=>upd(i,"availability",e.target.value)} /></Field>
              <Field label="Consultation Fee"><Input type="number" value={d.fee||""} onChange={(e)=>upd(i,"fee",e.target.value)} /></Field>
              <div className="md:col-span-2 lg:col-span-3"><Field label="Biography"><Textarea rows={2} value={d.bio||""} onChange={(e)=>upd(i,"bio",e.target.value)} /></Field></div>
              <div className="md:col-span-2 lg:col-span-3"><Field label="Awards"><Textarea rows={2} value={d.awards||""} onChange={(e)=>upd(i,"awards",e.target.value)} /></Field></div>
            </div>
            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!d.bookable} onCheckedChange={(v)=>upd(i,"bookable",v)} />Bookable</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!d.visible} onCheckedChange={(v)=>upd(i,"visible",v)} />Visible in Patient App</label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FacilitiesTab({ profile, patch }: any) {
  const set = new Set(profile.facilities || []);
  const toggle = (f: string) => { set.has(f) ? set.delete(f) : set.add(f); patch("facilities", Array.from(set)); };
  return (
    <Card><CardHeader><CardTitle>Facilities & Services</CardTitle><CardDescription>Auto-shown in the Patient App and hospital cards</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {FACILITY_CATALOG.map((f) => {
          const on = set.has(f);
          return (
            <button key={f} onClick={()=>toggle(f)} className={`rounded-xl border p-3 text-sm text-left transition-all ${on?"bg-primary/10 border-primary text-primary font-semibold":"bg-card hover:border-primary/40"}`}>
              {on && <CheckCircle2 className="h-4 w-4 mb-1" />}
              {f}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ profile, patch, hospitalId }: any) {
  const docs = profile.documents || {};
  const set = (k: string, v: any) => patch("documents", { ...docs, [k]: v });
  return (
    <Card><CardHeader><CardTitle>Documents & Templates</CardTitle><CardDescription>Applied automatically to generated PDFs</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOC_TEMPLATES.map((t) => (
          <AssetUploader key={t.key} label={t.label} hospitalId={hospitalId} folder={`documents/${t.key}`} accept="image/*,application/pdf" value={docs[t.key]} onChange={(v)=>set(t.key,v)} />
        ))}
      </CardContent>
    </Card>
  );
}

function SignaturesTab({ profile, patch, hospitalId }: any) {
  const sigs = profile.signatures || {};
  const set = (k: string, v: any) => patch("signatures", { ...sigs, [k]: v });
  return (
    <Card><CardHeader><CardTitle>Digital Signatures</CardTitle><CardDescription>Applied to prescriptions, reports and certificates</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SIGNATURE_ROLES.map((r) => (
          <AssetUploader key={r.key} label={r.label} hospitalId={hospitalId} folder={`signatures/${r.key}`} value={sigs[r.key]} onChange={(v)=>set(r.key,v)} />
        ))}
      </CardContent>
    </Card>
  );
}

function PatientAppTab({ profile, patch }: any) {
  const a = profile.patient_app || {};
  const set = (k: string, v: any) => patch("patient_app", { ...a, [k]: v });
  return (
    <Card><CardHeader><CardTitle>Patient App Content</CardTitle><CardDescription>Content that appears directly inside the EzyOp Patient App</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><Field label="Hospital Overview"><Textarea rows={3} value={a.overview||""} onChange={(e)=>set("overview",e.target.value)} /></Field></div>
        <Field label="Hospital Story"><Textarea rows={4} value={a.story||""} onChange={(e)=>set("story",e.target.value)} /></Field>
        <Field label="Announcements"><Textarea rows={4} placeholder="One per line" value={a.announcements||""} onChange={(e)=>set("announcements",e.target.value)} /></Field>
        <Field label="Featured Services"><Textarea rows={3} placeholder="One per line" value={a.featuredServices||""} onChange={(e)=>set("featuredServices",e.target.value)} /></Field>
        <Field label="Health Packages"><Textarea rows={3} placeholder="One per line" value={a.packages||""} onChange={(e)=>set("packages",e.target.value)} /></Field>
        <Field label="Videos (YouTube URLs)"><Textarea rows={3} placeholder="One per line" value={a.videos||""} onChange={(e)=>set("videos",e.target.value)} /></Field>
        <Field label="Health Tips"><Textarea rows={3} placeholder="One per line" value={a.tips||""} onChange={(e)=>set("tips",e.target.value)} /></Field>
        <div className="md:col-span-2"><Field label="FAQs (Q :: A per line)"><Textarea rows={4} value={a.faqs||""} onChange={(e)=>set("faqs",e.target.value)} /></Field></div>
      </CardContent>
    </Card>
  );
}

function ContactTab({ profile, patch }: any) {
  const c = profile.contact || {};
  const set = (k: string, v: any) => patch("contact", { ...c, [k]: v });
  const rows = [
    ["phone","Phone"],["whatsapp","WhatsApp"],["email","Email"],["website","Website"],
    ["googleMaps","Google Maps"],["facebook","Facebook"],["instagram","Instagram"],
    ["linkedin","LinkedIn"],["youtube","YouTube"],
  ] as const;
  return (
    <Card><CardHeader><CardTitle>Contact & Social Links</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(([k,l])=><Field key={k} label={l}><Input value={c[k]||""} onChange={(e)=>set(k,e.target.value)} /></Field>)}
      </CardContent>
    </Card>
  );
}

function ComplianceTab({ profile, patch }: any) {
  const items: any[] = profile.compliance || [];
  const upd = (i: number, k: string, v: any) => patch("compliance", items.map((r,idx)=>idx===i?{...r,[k]:v}:r));
  const add = () => patch("compliance", [...items, { name: "", number: "", expiry: "" }]);
  const del = (i: number) => patch("compliance", items.filter((_,idx)=>idx!==i));
  const soon = (d: string) => { if(!d) return false; const t = new Date(d).getTime()-Date.now(); return t>0 && t < 1000*60*60*24*60; };
  const expired = (d: string) => { if(!d) return false; return new Date(d).getTime() < Date.now(); };
  return (
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Compliance & Licenses</CardTitle><Button onClick={add}><Plus className="h-4 w-4" />Add</Button></CardHeader>
      <CardContent className="space-y-2">
        {items.map((r, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-2 items-center rounded-lg border p-3">
            <Input placeholder="License / Certification" value={r.name||""} onChange={(e)=>upd(i,"name",e.target.value)} />
            <Input placeholder="Number" value={r.number||""} onChange={(e)=>upd(i,"number",e.target.value)} />
            <Input type="date" value={r.expiry||""} onChange={(e)=>upd(i,"expiry",e.target.value)} />
            <div>{expired(r.expiry) ? <Badge variant="destructive">Expired</Badge> : soon(r.expiry) ? <Badge className="bg-warning/20 text-warning border-warning/40">Expiring Soon</Badge> : r.expiry ? <Badge variant="outline">Valid</Badge> : null}</div>
            <Button size="icon" variant="ghost" onClick={()=>del(i)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PreviewTab({ profile }: { profile: Profile }) {
  const b = profile.basic || {};
  const br = profile.branding || {};
  const cover = (profile.gallery || []).find((g:any)=>g.cover) || (profile.gallery || [])[0];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Patient App Preview</CardTitle><CardDescription>Exactly how this hospital appears in EzyOp</CardDescription></CardHeader>
        <CardContent>
          <div className="max-w-md mx-auto rounded-3xl border shadow-lg overflow-hidden bg-background">
            <div className="h-40 bg-muted relative">
              {cover?.url ? <img src={cover.url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gradient-to-br" style={{ backgroundImage:`linear-gradient(135deg, ${br.primaryColor||"#7c3aed"}, ${br.secondaryColor||"#0ea5e9"})` }} />}
              {br.primaryLogo?.url && <img src={br.primaryLogo.url} className="absolute bottom-2 left-3 h-12 bg-white rounded-md p-1" alt="" />}
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-lg font-bold">{b.name || "Your Hospital"}</div>
                <div className="text-xs text-muted-foreground">{b.type} · {b.city}</div>
              </div>
              <p className="text-sm">{b.description || "Hospital description appears here."}</p>
              {profile.facilities?.length ? (
                <div className="flex flex-wrap gap-1">
                  {profile.facilities.slice(0,8).map((f)=>(<Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>))}
                </div>
              ) : null}
              <Separator />
              <div>
                <div className="text-xs font-semibold mb-2">Doctors</div>
                <div className="grid grid-cols-3 gap-2">
                  {(profile.doctors||[]).filter((d:any)=>d.visible).slice(0,6).map((d:any)=>(
                    <div key={d.id} className="text-center">
                      <div className="aspect-square rounded-full bg-muted overflow-hidden mb-1">{d.photo?.url && <img src={d.photo.url} className="w-full h-full object-cover" alt="" />}</div>
                      <div className="text-[10px] font-medium truncate">{d.name}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{d.specialization}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}