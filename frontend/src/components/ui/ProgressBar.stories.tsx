import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';
import '../../index.css';

const meta = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px', maxWidth: '100%', padding: '2rem', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Safe: Story = {
  args: {
    previsto: 1000,
    realizado: 500, // 50%
  },
};

export const Warning: Story = {
  args: {
    previsto: 1000,
    realizado: 900, // 90%
  },
};

export const Danger: Story = {
  args: {
    previsto: 1000,
    realizado: 1100, // 110%
  },
};

export const Empty: Story = {
  args: {
    previsto: 1000,
    realizado: 0, // 0%
  },
};

export const NoPrevisto: Story = {
  args: {
    previsto: 0,
    realizado: 100, // Error state - danger
  },
};
