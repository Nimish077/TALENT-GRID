import logo from "../../assets/TalentGrid-Logo (2).svg";

function LandingFooter() {
  return <footer className="border-t border-border"><div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8"><div className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7" /><span className="font-semibold text-text-primary">TalentGrid</span></div><p className="text-text-muted">&copy; 2025 TalentGrid. Verified skills platform.</p></div></footer>;
}

export default LandingFooter;
