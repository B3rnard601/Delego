import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MAX_EVIDENCE_URLS } from "../../lib/disputes";
import { DisputeModal } from "./DisputeModal";

const mockScrubExifMetadata = vi.fn();
const mockBlobToDataUrl = vi.fn();

vi.mock("../../lib/exif", () => ({
  scrubExifMetadata: (...args: unknown[]) => mockScrubExifMetadata(...args),
  blobToDataUrl: (...args: unknown[]) => mockBlobToDataUrl(...args),
}));

function renderModal(onSubmit = vi.fn()) {
  render(<DisputeModal isOpen onSubmit={onSubmit} onClose={vi.fn()} />);
  return onSubmit;
}

function imageFile(name = "beach.jpg", type = "image/jpeg") {
  return new File(["original-with-exif"], name, { type });
}

describe("DisputeModal — photo evidence EXIF scrubbing (#789)", () => {
  beforeEach(() => {
    mockScrubExifMetadata.mockReset();
    mockBlobToDataUrl.mockReset();
    mockScrubExifMetadata.mockResolvedValue(new Blob(["scrubbed"], { type: "image/png" }));
    mockBlobToDataUrl.mockResolvedValue("data:image/png;base64,SCRUBBED");
  });

  it("still submits typed evidence URLs", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();

    await user.type(screen.getByPlaceholderText("Describe what happened"), "Item never arrived");
    await user.type(screen.getByLabelText("Evidence URL 1"), "https://example.com/receipt.png");
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "item_not_received",
      description: "Item never arrived",
      evidenceUrls: ["https://example.com/receipt.png"],
    });
  });

  it("scrubs selected photos in the browser before including them as evidence", async () => {
    const user = userEvent.setup();
    const onSubmit = renderModal();
    const file = imageFile();

    await user.upload(screen.getByTestId("dispute-photo-input"), file);

    // The scrubbed result is shown, and the original file went through the
    // scrubber rather than being attached verbatim.
    await screen.findByText("Metadata removed");
    expect(mockScrubExifMetadata).toHaveBeenCalledWith(file);
    expect(mockBlobToDataUrl).toHaveBeenCalledTimes(1);

    await user.type(screen.getByPlaceholderText("Describe what happened"), "Wrong item shipped");
    await user.click(screen.getByRole("button", { name: "Submit dispute" }));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "item_not_received",
      description: "Wrong item shipped",
      evidenceUrls: ["data:image/png;base64,SCRUBBED"],
    });
  });

  it("reports a scrubbing failure without attaching anything", async () => {
    mockScrubExifMetadata.mockRejectedValue(
      new Error("Could not decode the selected image. Try a JPEG, PNG, or WebP file.")
    );
    const user = userEvent.setup();
    renderModal();

    await user.upload(screen.getByTestId("dispute-photo-input"), imageFile("broken.jpg"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not decode");
    expect(screen.queryByText("Metadata removed")).toBeNull();
  });

  it("lets the buyer remove an attached photo", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.upload(screen.getByTestId("dispute-photo-input"), imageFile());
    await screen.findByText("Metadata removed");

    await user.click(screen.getByRole("button", { name: "Remove photo beach.jpg" }));

    expect(screen.queryByText("Metadata removed")).toBeNull();
  });

  it("caps photo evidence at the shared evidence limit", async () => {
    const user = userEvent.setup();
    renderModal();

    const files = Array.from({ length: MAX_EVIDENCE_URLS + 1 }, (_, i) =>
      imageFile(`photo-${i + 1}.jpg`)
    );
    await user.upload(screen.getByTestId("dispute-photo-input"), files);

    expect(await screen.findAllByText("Metadata removed")).toHaveLength(MAX_EVIDENCE_URLS);
    expect(screen.getByRole("alert")).toHaveTextContent(
      `up to ${MAX_EVIDENCE_URLS} pieces of evidence are allowed`
    );
  });
});
