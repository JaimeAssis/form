'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy } from 'lucide-react'

interface PublishModalProps {
  open: boolean
  onClose: () => void
  slug: string
}

export function PublishModal({ open, onClose, slug }: PublishModalProps) {
  const [copied, setCopied] = useState(false)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const publicUrl = `${appUrl}/f/${slug}`

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Formulário publicado!</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-3">Seu formulário está disponível no link abaixo. Compartilhe com seus clientes.</p>
        <div className="flex gap-2">
          <Input value={publicUrl} readOnly className="text-sm font-mono" />
          <Button variant="outline" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        {copied && <p className="text-xs text-green-600 text-center mt-1">Link copiado!</p>}
        <Button className="w-full mt-2" onClick={onClose}>Fechar</Button>
      </DialogContent>
    </Dialog>
  )
}
