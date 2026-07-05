/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SetupForm from "./SetupForm";

// Mock the setupProfileAction server action
const mockSetupProfileAction = jest.fn();
jest.mock("@/actions/profile", () => ({
  setupProfileAction: (...args: unknown[]) => mockSetupProfileAction(...args),
}));

// Mock validateEmail from validators
jest.mock("@/lib/validators", () => ({
  validateEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
}));

describe("SetupForm", () => {
  beforeEach(() => {
    mockSetupProfileAction.mockReset();
  });

  it("renders all required fields with labels", () => {
    render(<SetupForm />);

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/profile image/i)).toBeInTheDocument();
  });

  it("renders a submit button with correct text", () => {
    render(<SetupForm />);

    const button = screen.getByRole("button", { name: /complete setup/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("all interactive elements have min 44x44 touch targets", () => {
    render(<SetupForm />);

    const firstName = screen.getByLabelText(/first name/i);
    const lastName = screen.getByLabelText(/last name/i);
    const email = screen.getByLabelText(/email/i);
    const password = screen.getByLabelText(/password/i);
    const button = screen.getByRole("button", { name: /complete setup/i });

    expect(firstName.className).toContain("min-h-[44px]");
    expect(firstName.className).toContain("min-w-[44px]");
    expect(lastName.className).toContain("min-h-[44px]");
    expect(lastName.className).toContain("min-w-[44px]");
    expect(email.className).toContain("min-h-[44px]");
    expect(email.className).toContain("min-w-[44px]");
    expect(password.className).toContain("min-h-[44px]");
    expect(password.className).toContain("min-w-[44px]");
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("min-w-[44px]");
  });

  it("shows field-level validation errors when required fields are empty", () => {
    render(<SetupForm />);

    const button = screen.getByRole("button", { name: /complete setup/i });
    fireEvent.click(button);

    expect(screen.getByText("First name is required.")).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("shows email format error for invalid email", () => {
    render(<SetupForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "invalid-email" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    const button = screen.getByRole("button", { name: /complete setup/i });
    fireEvent.click(button);

    expect(
      screen.getByText(
        "Please enter a valid email address (e.g. name@example.com)."
      )
    ).toBeInTheDocument();
  });

  it("does NOT show modal when validation fails", () => {
    render(<SetupForm />);

    const button = screen.getByRole("button", { name: /complete setup/i });
    fireEvent.click(button);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens liability disclaimer modal on valid submission", () => {
    render(<SetupForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    const button = screen.getByRole("button", { name: /complete setup/i });
    fireEvent.click(button);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/liability disclaimer/i, { selector: "h2" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /i acknowledge/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel/i })
    ).toBeInTheDocument();
  });

  it("closes modal on Cancel without calling setupProfileAction", () => {
    render(<SetupForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /complete setup/i }));

    // Modal is open
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Modal is closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Action was not called
    expect(mockSetupProfileAction).not.toHaveBeenCalled();
  });

  it("calls setupProfileAction on 'I acknowledge' click", async () => {
    mockSetupProfileAction.mockResolvedValue({ success: true });

    render(<SetupForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /complete setup/i }));
    fireEvent.click(screen.getByRole("button", { name: /i acknowledge/i }));

    await waitFor(() => {
      expect(mockSetupProfileAction).toHaveBeenCalledTimes(1);
    });

    // Verify FormData was passed with correct values
    const formData = mockSetupProfileAction.mock.calls[0][0] as FormData;
    expect(formData.get("firstName")).toBe("Jane");
    expect(formData.get("lastName")).toBe("Doe");
    expect(formData.get("email")).toBe("jane@example.com");
    expect(formData.get("password")).toBe("password123");
  });

  it("displays server-side errors after failed submission", async () => {
    mockSetupProfileAction.mockResolvedValue({
      success: false,
      errors: { email: "Email is already registered." },
    });

    render(<SetupForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /complete setup/i }));
    fireEvent.click(screen.getByRole("button", { name: /i acknowledge/i }));

    await waitFor(() => {
      expect(screen.getByText("Email is already registered.")).toBeInTheDocument();
    });

    // Modal should be closed after server errors
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears field error when user types in the field", () => {
    render(<SetupForm />);

    // Trigger validation errors
    fireEvent.click(screen.getByRole("button", { name: /complete setup/i }));
    expect(screen.getByText("First name is required.")).toBeInTheDocument();

    // Type in first name field
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "J" },
    });

    // Error should be cleared
    expect(screen.queryByText("First name is required.")).not.toBeInTheDocument();
  });
});
