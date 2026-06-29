import type { Meta, StoryObj } from '@storybook/react';
import { CurrencyInput } from './CurrencyInput';
import { useState } from 'react';
import '../../index.css';

const meta = {
  title: 'UI/CurrencyInput',
  component: CurrencyInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onChange: () => {},
  }
} satisfies Meta<typeof CurrencyInput>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper to manage state in Storybook
const CurrencyInputWrapper = (args: any) => {
  const [value, setValue] = useState(args.value || 0);
  return (
    <div style={{ width: '300px' }}>
      <CurrencyInput {...args} value={value} onChange={setValue} />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <CurrencyInputWrapper {...args} />,
  args: {
    value: 0,
    label: 'Amount',
  },
};

export const WithInitialValue: Story = {
  render: (args) => <CurrencyInputWrapper {...args} />,
  args: {
    value: 1250.50,
    label: 'Salary',
  },
};

export const WithoutLabel: Story = {
  render: (args) => <CurrencyInputWrapper {...args} />,
  args: {
    value: 0,
  },
};
