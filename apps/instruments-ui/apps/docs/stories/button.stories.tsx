import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@instruments/ui/button";
import "./button.stories.css";

const meta: Meta<typeof Button> = {
  title: "Controls/Button",
  component: Button,
  args: { children: "Button", variant: "primary", type: "button" },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "secondary", "ghost", "destructive"],
    },
    type: { control: "radio", options: ["button", "submit", "reset"] },
    disabled: { control: "boolean" },
    onClick: { action: "clicked" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete track" },
};
export const Disabled: Story = { args: { disabled: true } };

export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story: "Use the Theme toolbar to compare light and dark colors. Hover, press, or tab to each button to inspect its interactive states.",
      },
    },
  },
  render: (args) => (
    <div className="beats-button-gallery">
      {(["primary", "secondary", "ghost", "destructive"] as const).map(
        (variant) => (
          <section className="beats-button-gallery-section" key={variant}>
            <h2>{variant}</h2>
            <Button {...args} variant={variant} />
            <Button {...args} disabled variant={variant} />
          </section>
        ),
      )}
    </div>
  ),
};
