import type { Preview } from "@storybook/react";
import "@instruments/ui/theme.css";
import "./preview.css";

const preview: Preview = {
  initialGlobals: { theme: "dark" },
  globalTypes: {
    theme: {
      description: "Beats color theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        dynamicTitle: true,
        items: [
          { value: "dark", title: "Dark", icon: "moon" },
          { value: "light", title: "Light", icon: "sun" },
        ],
      },
    },
  },
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
  decorators: [
    (Story, context) => (
      <div
        className="beats-preview"
        data-theme={context.globals.theme === "light" ? "light" : "dark"}
        data-view-mode={context.viewMode}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
