import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useState } from 'react';
import '../../index.css';

const meta = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const ModalWrapper = (args: any) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div style={{ color: 'var(--text-muted)' }}>
          <p>This is the modal content.</p>
          <p style={{ marginTop: '1rem' }}>It provides a focused environment for user interactions without leaving the current context.</p>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setIsOpen(false)}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const Default: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    isOpen: false,
    title: 'Edit Transaction',
    onClose: () => {},
    children: null,
  },
};
