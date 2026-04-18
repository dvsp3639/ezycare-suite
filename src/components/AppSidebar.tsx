import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { modules } from "@/data/modules";
import { LogOut, LayoutDashboard } from "lucide-react";
import ezyopIcon from "@/assets/ezyop-icon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isHospitalAdmin, isSuperAdmin, allowedModules } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const visibleModules = modules.filter((mod) => {
    if (mod.id === "users-roles") return isHospitalAdmin || isSuperAdmin;
    // Super admins and hospital admins see all modules
    if (isSuperAdmin || isHospitalAdmin) return true;
    // If user has module permissions set, only show allowed ones
    return allowedModules.includes(mod.id);
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-12 h-12 rounded-xl flex-shrink-0 bg-white shadow-sm flex items-center justify-center">
          <img src={ezyopIcon} alt="EZY OP" className="w-9 h-9 object-contain" />
        </div>
        {!collapsed && (
          <span className="font-display font-extrabold text-sidebar-foreground text-2xl tracking-tight">
            Ezy<span className="text-sidebar-primary">op</span>
          </span>
        )}
      </div>

      <SidebarContent className="flex flex-col flex-1 overflow-hidden">
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/dashboard")}
                  className={`rounded-lg transition-colors ${isActive("/dashboard") ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/60"}`}
                >
                  <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span className="text-sm">Dashboard</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1 flex flex-col min-h-0 pb-2">
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider px-3 flex-shrink-0">
            {!collapsed ? "Modules" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent className="flex-1 flex flex-col min-h-0">
            <SidebarMenu className="flex-1 flex flex-col justify-evenly gap-0.5 overflow-y-auto">
              {visibleModules.map((mod) => {
                const active = isActive(mod.route);
                return (
                  <SidebarMenuItem key={mod.id}>
                    <SidebarMenuButton
                      onClick={() => navigate(mod.route)}
                      className={`rounded-lg transition-all duration-150 group relative ${active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:translate-x-0.5"}`}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-sidebar-primary rounded-r-full" />
                      )}
                      <mod.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="text-sm truncate">{mod.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="mb-2 px-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user.user_metadata?.full_name || user.email}</p>
            <p className="text-[10px] text-sidebar-muted">{user.email}</p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              className="text-sidebar-foreground hover:bg-sidebar-accent/50"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
