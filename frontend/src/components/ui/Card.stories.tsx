import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Button } from './Button';
import '../../index.css';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <p style={{ margin: 0, color: 'var(--text-muted)' }}>This is the content of the card. It looks clean and premium.</p>,
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Financial Overview',
    children: <p style={{ margin: 0, color: 'var(--text-muted)' }}>Overview of your current financial status.</p>,
  },
};

export const WithTitleAndSubtitle: Story = {
  args: {
    title: 'Monthly Expenses',
    subtitle: 'Track your fixed and variable costs',
    children: <p style={{ margin: 0, color: 'var(--text-muted)' }}>Detailed view of your expenses for the month.</p>,
  },
};

export const WithAction: Story = {
  args: {
    title: 'Recent Transactions',
    action: <Button variant="primary">Add New</Button>,
    children: <p style={{ margin: 0, color: 'var(--text-muted)' }}>List of recent transactions goes here.</p>,
  },
};
