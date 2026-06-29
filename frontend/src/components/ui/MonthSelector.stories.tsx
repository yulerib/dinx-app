import type { Meta, StoryObj } from '@storybook/react';
import { MonthSelector } from './MonthSelector';
import { MonthProvider } from '../../contexts/MonthContext';
import '../../index.css';

const meta = {
  title: 'UI/MonthSelector',
  component: MonthSelector,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <MonthProvider>
        <Story />
      </MonthProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof MonthSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
