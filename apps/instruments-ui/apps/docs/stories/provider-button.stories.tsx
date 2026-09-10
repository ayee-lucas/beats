import type { Meta, StoryObj } from "@storybook/react";
import { ProviderButton } from "@instruments/ui/provider-button";
import "./provider-button.stories.css";

const meta: Meta<typeof ProviderButton> = {
  title: "Controls/ProviderButton",
  component: ProviderButton,
  args: { provider: "apple", disabled: false },
  argTypes: {
    provider: { control: "radio", options: ["apple", "google"] },
    disabled: { control: "boolean" },
    label: { control: "text" },
    iconSrc: { control: "text" },
    onClick: { action: "sign-in requested" },
  },
  decorators: [
    (Story) => (
      <div className="beats-provider-preview">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProviderButton>;

export const Apple: Story = {};
export const Google: Story = { args: { provider: "google" } };
export const Disabled: Story = { args: { disabled: true } };

export const Providers: Story = {
  render: ({ disabled, onClick }) => (
    <div className="beats-provider-stack">
      <ProviderButton disabled={disabled} onClick={onClick} provider="apple" />
      <ProviderButton disabled={disabled} onClick={onClick} provider="google" />
    </div>
  ),
};
