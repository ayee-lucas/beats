import type { Meta, StoryObj } from "@storybook/react";
import { RecordArtwork } from "@instruments/ui/artwork/record";

const meta: Meta<typeof RecordArtwork> = {
  title: "Brand/Artwork/Record",
  component: RecordArtwork,
  args: { size: 540 },
  argTypes: {
    size: { control: { type: "range", min: 108, max: 810, step: 27 } },
    label: { control: "text" },
  },
};
export default meta;
type Story = StoryObj<typeof RecordArtwork>;

export const Default: Story = {};
export const Small: Story = { args: { size: 270 } };
export const WithDescription: Story = {
  args: { label: "Beats vinyl record, side A, number 001" },
};
export const NarrowContainer: Story = {
  render: (args) => (
    <div style={{ width: 240, maxWidth: "100%" }}>
      <RecordArtwork {...args} />
    </div>
  ),
};
