import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './StatCard';
import { Wallet, CalendarDays } from 'lucide-react';
import { BrowserRouter } from 'react-router-dom';
import '../../index.css';

const meta: Meta<typeof StatCard> = {
  title: 'UI/Moléculas/StatCard',
  component: StatCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div style={{ maxWidth: '400px' }}>
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const GastosFixosExample: Story = {
  args: {
    icon: <Wallet size={18} color="var(--primary)" />,
    title: 'Gastos Fixos',
    description: 'Despesas essenciais do mês',
    linkTo: '/fixos',
    linkText: 'Gerenciar Fixos',
    valueDisplay: (
      <>
        <span className="text-h2" style={{ margin: 0, color: 'var(--success)' }}>
          R$ 1.500,00
        </span>
        <span className="text-muted" style={{ fontSize: '0.875rem' }}>/ R$ 2.000,00</span>
      </>
    ),
  },
};

export const OverBudgetExample: Story = {
  args: {
    icon: <CalendarDays size={18} color="var(--primary)" />,
    title: 'Gastos Diários',
    description: 'Gasto total executado até hoje',
    linkTo: '/diarios',
    linkText: 'Gerenciar Diários',
    valueDisplay: (
      <>
        <span className="text-h2" style={{ margin: 0, color: 'var(--danger)' }}>
          R$ 600,00
        </span>
        <span className="text-muted" style={{ fontSize: '0.875rem' }}>/ Limite R$ 500,00</span>
      </>
    ),
  },
};
