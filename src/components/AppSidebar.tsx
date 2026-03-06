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
  const { user, logout, isHospitalAdmin, isSuperAdmin } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const visibleModules = modules.filter((mod) => {
    if (mod.id === "users-roles") return isHospitalAdmin || isSuperAdmin;
    return true;
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <img src={ezyopIcon} alt="EZY OP" className="w-8 h-8 rounded-md flex-shrink-0" />
        {!collapsed && (
          <span className="font-display font-bold text-sidebar-foreground text-lg">
            Ezy<span className="text-sidebar-primary">op</span>
          </span>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/dashboard")}
                  className={`${isActive("/dashboard") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                >
                  <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && <span>Dashboard</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider">
            {!collapsed ? "Modules" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((mod) => (
                <SidebarMenuItem key={mod.id}>
                  <SidebarMenuButton
                    onClick={() => navigate(mod.route)}
                    className={`${isActive(mod.route) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                  >
                    <mod.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="text-sm">{mod.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
