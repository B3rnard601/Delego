import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DisputeModal } from "./DisputeModal";

const DRAFT_KEY = "delego_dispute_draft:escrow-9";

function seedDraft(overrides: Record<string, unknown> = {}) {
  window.sessionStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      reason: "item_not_received",
      description: "Seeded draft",
      evidenceUrls: [""],
      ...overrides,
    })
  );
}

describe("DisputeModal draft persistence (#746)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("restores a draft saved before the refresh", async () => {
    seedDraft({
      reason: "not_as_described",
      description: "The screen arrived cracked",
      evidenceUrls: ["https://evidence.example/photo.jpg"],
    });

    render(
      <DisputeModal
        isOpen
        escrowId="escrow-9"
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByDisplayValue("The screen arrived cracked")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toHaveValue("not_as_described");
    expect(screen.getByLabelText("Evidence URL 1")).toHaveValue(
      "https://evidence.example/photo.jpg"
    );
  });

  it("persists typed input to sessionStorage as the user edits", async () => {
    const user = userEvent.setup();
    render(
      <DisputeModal
        isOpen
        escrowId="escrow-9"
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText(/reason/i), "other");
    await user.type(screen.getByLabelText(/description/i), "Never delivered");

    await waitFor(() => {
      expect(
        JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) as string)
      ).toMatchObject({ reason: "other", description: "Never delivered" });
    });
  });

  it("clears the stored draft after a successful submit", async () => {
    seedDraft({ description: "Submit me" });
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ id: "dispute-1" });

    render(
      <DisputeModal
        isOpen
        escrowId="escrow-9"
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );
    await screen.findByDisplayValue("Submit me");

    await user.click(screen.getByRole("button", { name: /submit dispute/i }));

    await waitFor(() =>
      expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull()
    );
    expect(screen.getByLabelText(/description/i)).toHaveValue("");
  });

  it("keeps the draft when the submission reports failure", async () => {
    seedDraft({ description: "Keep me" });
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(null);

    render(
      <DisputeModal
        isOpen
        escrowId="escrow-9"
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    );
    await screen.findByDisplayValue("Keep me");

    await user.click(screen.getByRole("button", { name: /submit dispute/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(screen.getByLabelText(/description/i)).toHaveValue("Keep me");
  });
});
