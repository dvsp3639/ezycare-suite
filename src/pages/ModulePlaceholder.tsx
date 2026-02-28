import { useParams } from "react-router-dom";
import { modules } from "@/data/modules";
import { Construction } from "lucide-react";

const ModulePlaceholder = () => {
  const { moduleId } = useParams();
  const mod = modules.find((m) => m.route === `/${moduleId}`);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-display font-bold text-foreground">
        {mod?.title || "Module"}
      </h2>
      <p className="text-muted-foreground mt-2 text-center max-w-sm">
        This module is under development. Stay tuned!
      </p>
    </div>
  );
};

export default ModulePlaceholder;
