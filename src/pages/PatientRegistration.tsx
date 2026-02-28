import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, UserPlus, Save, Printer, Calendar, Clock, X } from "lucide-react";
import { mockPatients, mockDoctors, generateRegistrationNumber, type Patient } from "@/data/mockPatients";
import TimeSlotPicker from "@/components/TimeSlotPicker";

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

const emptyPatient: Omit<Patient, "id" | "registrationNumber"> = {
  name: "", mobile: "", dob: "", gender: "Male", emergencyContact: "",
  bloodGroup: "", address: "", chronicConditions: "",
};

const PatientRegistration = () => {
  const [searchMobile, setSearchMobile] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[] | null>(null);
  const [form, setForm] = useState(emptyPatient);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);

  // OPD Booking
  const [showOPD, setShowOPD] = useState(false);
  const [opdDate, setOpdDate] = useState("");
  const [opdType, setOpdType] = useState("");
  const [opdDoctor, setOpdDoctor] = useState("");
  const [opdTimeSlot, setOpdTimeSlot] = useState("");
  const [showTimeSlots, setShowTimeSlots] = useState(false);

  const handleSearch = () => {
    if (searchMobile.length < 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    const found = mockPatients.filter((p) => p.mobile === searchMobile);
    setSearchResults(found);
    setSelectedPatient(null);
    setIsRegistered(false);
    setShowOPD(false);
    setShowAddNew(false);
    if (found.length === 0) {
      setForm({ ...emptyPatient, mobile: searchMobile });
    }
  };

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setForm({
      name: p.name, mobile: p.mobile, dob: p.dob, gender: p.gender,
      emergencyContact: p.emergencyContact, bloodGroup: p.bloodGroup,
      address: p.address, chronicConditions: p.chronicConditions,
    });
    setIsRegistered(true);
    setRegistrationNumber(p.registrationNumber);
    setSearchResults(null);
    setShowAddNew(false);
  };

  const handleAddNewPatient = () => {
    setShowAddNew(true);
    setSelectedPatient(null);
    setIsRegistered(false);
    setRegistrationNumber("");
    setForm({ ...emptyPatient, mobile: searchMobile });
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.name || !form.mobile || !form.dob || !form.address) {
      toast.error("Please fill all required fields");
      return;
    }
    // Check duplicate name+mobile (case insensitive)
    const duplicate = mockPatients.find(
      (p) => p.mobile === form.mobile && p.name.toLowerCase() === form.name.toLowerCase()
    );
    if (duplicate) {
      toast.error("A patient with this name and mobile number already exists");
      return;
    }
    const regNum = generateRegistrationNumber();
    const newPatient: Patient = {
      id: Date.now().toString(),
      registrationNumber: regNum,
      ...form,
    };
    mockPatients.push(newPatient);
    setRegistrationNumber(regNum);
    setIsRegistered(true);
    setSelectedPatient(newPatient);
    setShowSaveDialog(true);
    setShowAddNew(false);
  };

  const handleOPDSave = (print: boolean) => {
    if (!opdDate || !opdType || !opdDoctor || !opdTimeSlot) {
      toast.error("Please fill all OPD booking details");
      return;
    }
    toast.success(`OPD booked successfully${print ? " — Printing..." : ""}`, {
      description: `${form.name} | ${formatDateDisplay(opdDate)} | ${opdTimeSlot}`,
    });
    if (print) window.print();
    setShowOPD(false);
  };

  const resetForm = () => {
    setForm(emptyPatient);
    setSelectedPatient(null);
    setIsRegistered(false);
    setRegistrationNumber("");
    setSearchMobile("");
    setSearchResults(null);
    setShowOPD(false);
    setShowAddNew(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Patient Registration</h1>
          <p className="text-sm text-muted-foreground">Search or register new patients</p>
        </div>
        <div className="flex gap-2">
          {((form.name && !isRegistered) || showAddNew) && (
            <Button onClick={handleSave} size="sm">
              <Save className="mr-2 h-4 w-4" />
              Save Details
            </Button>
          )}
          {isRegistered && (
            <Button onClick={() => setShowOPD(true)} size="sm">
              <Calendar className="mr-2 h-4 w-4" />
              Book OPD
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Search */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <Label className="text-sm font-medium text-foreground mb-2 block">Search by Mobile Number</Label>
        <div className="flex gap-3">
          <Input
            value={searchMobile}
            onChange={(e) => setSearchMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Enter 10-digit mobile number"
            className="h-11 max-w-xs font-mono"
          />
          <Button onClick={handleSearch} className="h-11">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          {(selectedPatient || form.name) && (
            <Button variant="outline" onClick={resetForm} className="h-11">
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults !== null && searchResults.length > 0 && !selectedPatient && !showAddNew && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">
              {searchResults.length} patient(s) found
            </p>
            <Button variant="outline" size="sm" onClick={handleAddNewPatient}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Patient
            </Button>
          </div>
          <div className="space-y-2">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPatient(p)}
                className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/50 transition-all flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.registrationNumber} · {p.gender} · DOB: {formatDateDisplay(p.dob)}</p>
                </div>
                <span className="text-xs text-primary font-medium">Select →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {searchResults !== null && searchResults.length === 0 && !showAddNew && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6 animate-fade-in text-center">
          <UserPlus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No patient found</p>
          <p className="text-xs text-muted-foreground">Fill the form below to register a new patient</p>
        </div>
      )}

      {/* Registration Number Badge */}
      {isRegistered && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-3 mb-6 flex items-center gap-3 animate-fade-in">
          <span className="text-sm font-medium text-success">✓ Registered</span>
          <span className="text-sm font-mono text-foreground font-semibold">{registrationNumber}</span>
        </div>
      )}

      {/* Patient Form */}
      {(searchResults !== null || selectedPatient || showAddNew) && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-foreground mb-4">Patient Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Full Name *</Label>
              <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Patient name" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mobile *</Label>
              <Input value={form.mobile} onChange={(e) => updateField("mobile", e.target.value)} placeholder="Mobile" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date of Birth *</Label>
              <Input type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Gender *</Label>
              <Select value={form.gender} onValueChange={(v) => updateField("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Emergency Contact</Label>
              <Input value={form.emergencyContact} onChange={(e) => updateField("emergencyContact", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Blood Group</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => updateField("bloodGroup", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs text-muted-foreground">Address *</Label>
              <Textarea value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Full address" rows={2} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs text-muted-foreground">Chronic Conditions</Label>
              <Input value={form.chronicConditions} onChange={(e) => updateField("chronicConditions", e.target.value)} placeholder="e.g., Diabetes, Hypertension (optional)" />
            </div>
          </div>
        </div>
      )}

      {/* OPD Booking Modal */}
      <Dialog open={showOPD} onOpenChange={setShowOPD}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Book OPD Appointment</DialogTitle>
            <p className="text-sm text-muted-foreground">{form.name} · {registrationNumber}</p>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date *</Label>
              <Input type="date" value={opdDate} onChange={(e) => setOpdDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">OPD Type *</Label>
              <Select value={opdType} onValueChange={setOpdType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Follow Up">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Doctor *</Label>
              <Select value={opdDoctor} onValueChange={setOpdDoctor}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {mockDoctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Time Slot *</Label>
              <Button variant="outline" onClick={() => setShowTimeSlots(true)} className="w-full justify-start h-10">
                <Clock className="mr-2 h-4 w-4" />
                {opdTimeSlot || "Select time slot"}
              </Button>
            </div>
          </div>
          <div className="flex gap-3 mt-4 pt-4 border-t border-border">
            <Button onClick={() => handleOPDSave(false)}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={() => handleOPDSave(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Save & Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Time Slot Picker Dialog */}
      <TimeSlotPicker
        open={showTimeSlots}
        onOpenChange={setShowTimeSlots}
        onSelect={setOpdTimeSlot}
        selectedTime={opdTimeSlot}
      />

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Patient Registered</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <p className="font-semibold text-foreground">{form.name}</p>
            <p className="text-sm font-mono text-primary mt-1">{registrationNumber}</p>
            <p className="text-xs text-muted-foreground mt-2">Registration saved successfully</p>
          </div>
          <Button onClick={() => setShowSaveDialog(false)} className="w-full">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientRegistration;
