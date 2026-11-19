import { Link } from "react-router-dom";
import logo from "../../assets/TalentGrid-Logo.svg";

function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="flex h-16 items-center px-5 sm:px-7">
          <Link to="/" className="flex items-center gap-2.5" aria-label="TalentGrid home">
            <img src={logo} alt="" className="h-8 w-8" />
            <span className="text-[17px] font-semibold tracking-tight text-text-primary">TalentGrid</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-col items-center px-5 pb-16 pt-16 sm:pt-24">{children}</main>
    </div>
  );
}

export default AuthLayout;
