import type { Meta, StoryObj } from "@storybook/react";
import { RecordSignalLabel } from "@instruments/ui/artwork/record-signal-label";

const meta: Meta<typeof RecordSignalLabel> = {
  title: "Brand/Artwork/RecordSignalLabel",
  component: RecordSignalLabel,
  args: { size: 172 },
  argTypes: {
    size: { control: { type: "range", min: 16, max: 344, step: 4 } },
    label: { control: "text" },
  },
  parameters: {
    docs: {
      description: {
        component: "Decorative record-label artwork. It has no interaction or recording state. Hidden from assistive technology unless a meaningful label is supplied.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof RecordSignalLabel>;

export const Default: Story = {};
export const Small: Story = { args: { size: 48 } };
export const WithMeaning: Story = { args: { label: "Beats record label" } };
