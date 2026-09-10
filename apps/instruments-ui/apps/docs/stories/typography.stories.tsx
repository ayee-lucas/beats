import type { Meta, StoryObj } from "@storybook/react";
import { Typography, typographyTags } from "@instruments/ui/typography";

const meta: Meta<typeof Typography> = {
  title: "Foundations/Typography",
  component: Typography,
  args: { variant: "body", children: "Find your rhythm." },
  argTypes: {
    variant: { control: "select", options: Object.keys(typographyTags) },
    as: {
      control: "select",
      options: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "span",
        "label",
        "small",
        "figcaption",
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof Typography>;

export const Playground: Story = {};
export const AllStyles: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 32, width: "100%", minWidth: 0 }}>
      {Object.entries(typographyTags).map(([variant, tag]) => (
        <section key={variant} style={{ minWidth: 0, overflowX: "auto" }}>
          <p style={{ marginBottom: 12, fontSize: 12 }}>
            {variant} — default &lt;{tag}&gt;
          </p>
          <Typography as="p" variant={variant as keyof typeof typographyTags}>
            Find your rhythm.
          </Typography>
        </section>
      ))}
    </div>
  ),
};
export const FormLabel: Story = {
  render: () => (
    <div>
      <Typography as="label" htmlFor="typography-email" variant="label">
        Email
      </Typography>
      <input id="typography-email" type="email" />
    </div>
  ),
};
