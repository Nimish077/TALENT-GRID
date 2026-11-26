import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../context/auth-context.js";
import { drivesApi, institutionsApi } from "../../lib/endpoints.js";
import DrivesPage from "./drives-page.jsx";

vi.mock("../../lib/endpoints.js", () => ({
  institutionsApi: { mine: vi.fn(), drives: vi.fn() },
  drivesApi: { open: vi.fn(), close: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const membership = (role = "owner", status = "active") => ({
  memberships: [{ status, role, institution: { id: "i1", name: "BITS", status } }],
});

const drives = [
  { id: "d1", title: "Acme Campus Drive", description: "Hiring SDEs", status: "open", application_open_at: "2026-01-05T00:00:00Z", application_deadline: "2026-01-20T00:00:00Z", min_cgpa: "7.5", max_backlogs: 0, eligible_batch: "2026", _count: { candidates: 12 } },
  { id: "d2", title: "Draft Drive", status: "draft", _count: { candidates: 0 } },
  { id: "d3", title: "Done Drive", status: "completed", _count: { candidates: 3 } },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { id: "u", role: "institute", full_name: "T" }, loading: false, logout: vi.fn() }}>
        <DrivesPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("institute drives page", () => {
  it("lists drives with eligibility, window and applicants", async () => {
    institutionsApi.mine.mockResolvedValue(membership());
    institutionsApi.drives.mockResolvedValue({ drives });
    renderPage();

    expect(await screen.findByText("Acme Campus Drive")).toBeInTheDocument();
    expect(screen.getByText("Min CGPA 7.5")).toBeInTheDocument();
    expect(screen.getByText("Max backlogs 0")).toBeInTheDocument();
    expect(screen.getByText("Batch 2026")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /(open|close) drive/i })).toHaveLength(2); // open drive: close; draft: open; completed: none
  });

  it("closes an open drive after confirmation and reloads", async () => {
    institutionsApi.mine.mockResolvedValue(membership("admin"));
    institutionsApi.drives.mockResolvedValue({ drives: [drives[0]] });
    drivesApi.close.mockResolvedValue({ drive: { ...drives[0], status: "closed" } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Close drive" }));
    expect(drivesApi.close).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    await user.click(dialog.querySelector("button:last-child"));
    await waitFor(() => expect(drivesApi.close).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(institutionsApi.drives).toHaveBeenCalledTimes(2));
  });

  it("shows the server message when a transition is rejected", async () => {
    institutionsApi.mine.mockResolvedValue(membership());
    institutionsApi.drives.mockResolvedValue({ drives: [drives[1]] });
    drivesApi.open.mockRejectedValue(new Error("Drive cannot be opened from its current status"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Open drive" }));
    await user.click(screen.getByRole("dialog").querySelector("button:last-child"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be opened/i);
  });

  it("hides actions from staff members", async () => {
    institutionsApi.mine.mockResolvedValue(membership("member"));
    institutionsApi.drives.mockResolvedValue({ drives });
    renderPage();

    expect(await screen.findByText("Acme Campus Drive")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /drive/i })).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    institutionsApi.mine.mockResolvedValue(membership());
    institutionsApi.drives.mockResolvedValue({ drives: [] });
    renderPage();
    expect(await screen.findByText("No placement drives yet")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    institutionsApi.mine.mockResolvedValue(membership());
    institutionsApi.drives.mockRejectedValueOnce(new Error("Network down")).mockResolvedValueOnce({ drives: [] });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No placement drives yet")).toBeInTheDocument();
  });

  it("shows a pending notice without loading drives", async () => {
    institutionsApi.mine.mockResolvedValue(membership("owner", "pending"));
    renderPage();
    expect(await screen.findByText("Verification pending")).toBeInTheDocument();
    expect(institutionsApi.drives).not.toHaveBeenCalled();
  });
});
