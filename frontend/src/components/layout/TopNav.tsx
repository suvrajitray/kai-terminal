import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/services/logout";

const navItemClass =
  "px-3 py-2 text-sm text-gray-400 hover:text-white transition";

const activeClass = "text-white border-b-2 border-blue-500";

export default function TopNav() {
  const { user, loading } = useAuth();

  return (
    <div className="h-14 bg-[#0b0f14] border-b border-gray-800 flex items-center justify-between px-6">
      {/* LEFT: App + Navigation */}
      <div className="flex items-center gap-8">
        {/* App Name */}
        <div className="text-lg font-semibold text-white">
          KAI Terminal <span className="text-xs text-gray-400">Pro</span>
        </div>

        {/* Nav Links */}
        <nav className="flex items-center gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${navItemClass} ${isActive ? activeClass : ""}`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/connect-broker"
            className={({ isActive }) =>
              `${navItemClass} ${isActive ? activeClass : ""}`
            }
          >
            Connect Broker
          </NavLink>

          <NavLink
            to="/positions"
            className={({ isActive }) =>
              `${navItemClass} ${isActive ? activeClass : ""}`
            }
          >
            Positions
          </NavLink>

          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `${navItemClass} ${isActive ? activeClass : ""}`
            }
          >
            Orders
          </NavLink>
        </nav>
      </div>

      {/* RIGHT: User */}
      <div className="flex items-center gap-4">
        {loading ? null : user ? (
          <>
            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium">
              {user.name.charAt(0)}
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-sm text-white">{user.name}</span>
              <span className="text-xs text-gray-400">{user.email}</span>
            </div>

            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-red-400 transition"
            >
              Logout
            </button>
          </>
        ) : (
          <span className="text-sm text-red-400">Not logged in</span>
        )}
      </div>
    </div>
  );
}
