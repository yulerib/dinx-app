import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { PlusCircle, Trash2 } from 'lucide-react';
import '../../index.css'; // Garantir que as variáveis CSS e tipografia sejam carregadas

const meta: Meta<typeof Button> = {
  title: 'UI/Átomos/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'outline', 'danger', 'ghost'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Salvar Alterações',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Cancelar',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Excluir Conta',
    icon: <Trash2 size={18} />,
  },
};

export const WithIcon: Story = {
  args: {
    variant: 'primary',
    children: 'Novo Registro',
    icon: <PlusCircle size={18} />,
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Apenas Texto',
  },
};
