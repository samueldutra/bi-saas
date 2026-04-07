'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface Departamento {
  id: number
  departamento_id: number
  descricao: string
}

interface DepartamentoNivel1Mapeado extends Departamento {
  pai_level_2_id: number | null
  pai_level_3_id: number | null
  pai_level_4_id: number | null
  pai_level_5_id: number | null
  pai_level_6_id: number | null
}

interface Setor {
  id: number
  nome: string
  departamento_nivel: number
  departamento_ids: number[]
  departamento_ids_nivel_1?: number[]
  ativo?: boolean
  created_at: string
}

interface ApiErrorResponse {
  error?: string
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

interface SetoresContentProps {
  tenantSchema: string
}

export function SetoresContent({ tenantSchema }: SetoresContentProps) {
  const [setores, setSetores] = useState<Setor[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [departamentosNivel1Mapeados, setDepartamentosNivel1Mapeados] = useState<DepartamentoNivel1Mapeado[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null)

  // Listen for custom event to open dialog
  useEffect(() => {
    const handleOpenDialog = () => {
      handleOpenDialogFunc()
    }
    window.addEventListener('openSetorDialog', handleOpenDialog)
    return () => window.removeEventListener('openSetorDialog', handleOpenDialog)
  }, [])

  const [formData, setFormData] = useState({
    nome: '',
    departamento_nivel: '1',
    departamento_ids: [] as number[]
  })

  const loadSetores = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/setores?schema=${tenantSchema}&include_level1=true`
      )

      if (!response.ok) throw new Error('Erro ao carregar setores')

      const data = await response.json()
      setSetores(data)
    } catch (error) {
      console.error('Error loading setores:', error)
      alert('Não foi possível carregar os setores')
    } finally {
      setLoading(false)
    }
  }, [tenantSchema])

  const loadDepartamentosNivel1Mapeados = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/setores/departamentos?schema=${tenantSchema}&nivel=1&include_parents=true`
      )

      if (!response.ok) throw new Error('Erro ao carregar mapeamento de departamentos')

      const data = await response.json()
      setDepartamentosNivel1Mapeados(data)
    } catch (error) {
      console.error('Error loading departments level 1 map:', error)
    }
  }, [tenantSchema])

  const loadDepartamentos = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/setores/departamentos?schema=${tenantSchema}&nivel=${formData.departamento_nivel}`
      )

      if (!response.ok) throw new Error('Erro ao carregar departamentos')

      const data = await response.json()
      setDepartamentos(data)
    } catch (error) {
      console.error('Error loading departamentos:', error)
      alert('Não foi possível carregar os departamentos')
    }
  }, [tenantSchema, formData.departamento_nivel])

  useEffect(() => {
    loadSetores()
  }, [loadSetores])

  useEffect(() => {
    loadDepartamentosNivel1Mapeados()
  }, [loadDepartamentosNivel1Mapeados])

  useEffect(() => {
    if (formData.departamento_nivel) {
      loadDepartamentos()
    }
  }, [formData.departamento_nivel, loadDepartamentos])

  const handleOpenDialogFunc = (setor?: Setor) => {
    if (setor) {
      setEditingSetor(setor)
      setFormData({
        nome: setor.nome,
        departamento_nivel: setor.departamento_nivel.toString(),
        departamento_ids: setor.departamento_ids
      })
    } else {
      setEditingSetor(null)
      setFormData({
        nome: '',
        departamento_nivel: '1',
        departamento_ids: []
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSetor(null)
    setFormData({
      nome: '',
      departamento_nivel: '1',
      departamento_ids: []
    })
  }

  const resolveDepartamentoIdsNivel1 = useCallback((nivel: number, departamentoIds: number[]) => {
    if (departamentoIds.length === 0) return []

    if (nivel === 1) {
      return Array.from(new Set(departamentoIds))
    }

    const ids = new Set<number>()

    departamentosNivel1Mapeados.forEach((departamento) => {
      const parentId =
        nivel === 2 ? departamento.pai_level_2_id
          : nivel === 3 ? departamento.pai_level_3_id
            : nivel === 4 ? departamento.pai_level_4_id
              : nivel === 5 ? departamento.pai_level_5_id
                : nivel === 6 ? departamento.pai_level_6_id
                  : null

      if (parentId !== null && departamentoIds.includes(parentId)) {
        ids.add(departamento.departamento_id)
      }
    })

    return Array.from(ids)
  }, [departamentosNivel1Mapeados])

  const conflitosPorDepartamentoNivel1 = useMemo(() => {
    const conflitos = new Map<number, string[]>()

    setores
      .filter((setor) => setor.ativo !== false && setor.id !== editingSetor?.id)
      .forEach((setor) => {
        ;(setor.departamento_ids_nivel_1 || []).forEach((departamentoIdNivel1) => {
          const nomesExistentes = conflitos.get(departamentoIdNivel1) || []
          nomesExistentes.push(setor.nome)
          conflitos.set(departamentoIdNivel1, nomesExistentes)
        })
      })

    return conflitos
  }, [setores, editingSetor?.id])

  const getConflitoDepartamento = useCallback((departamentoId: number) => {
    const departamentoNivel = Number(formData.departamento_nivel)
    const departamentoIdsNivel1 = resolveDepartamentoIdsNivel1(departamentoNivel, [departamentoId])

    if (departamentoIdsNivel1.length === 0) {
      return null
    }

    const setoresEmConflito = Array.from(new Set(
      departamentoIdsNivel1.flatMap((departamentoNivel1Id) => (
        conflitosPorDepartamentoNivel1.get(departamentoNivel1Id) || []
      ))
    ))

    if (setoresEmConflito.length === 0) {
      return null
    }

    return {
      departamentoIdsNivel1,
      setores: setoresEmConflito,
    }
  }, [conflitosPorDepartamentoNivel1, formData.departamento_nivel, resolveDepartamentoIdsNivel1])

  const conflitosSelecionados = useMemo(() => (
    formData.departamento_ids
      .map((departamentoId) => ({
        departamentoId,
        conflito: getConflitoDepartamento(departamentoId),
      }))
      .filter((item): item is {
        departamentoId: number
        conflito: NonNullable<ReturnType<typeof getConflitoDepartamento>>
      } => item.conflito !== null)
  ), [formData.departamento_ids, getConflitoDepartamento])

  const handleSaveSetor = async () => {
    if (!formData.nome || formData.departamento_ids.length === 0) {
      toast.error('Campos obrigatórios', {
        description: 'Preencha todos os campos para salvar o setor'
      })
      return
    }

    if (conflitosSelecionados.length > 0) {
      const setoresEmConflito = Array.from(new Set(
        conflitosSelecionados.flatMap((item) => item.conflito.setores)
      ))

      toast.error('Departamentos em conflito', {
        description: `Remova os departamentos que já pertencem aos setores ativos: ${setoresEmConflito.join(', ')}.`
      })
      return
    }

    setLoading(true)
    try {
      const url = editingSetor
        ? `/api/setores/${editingSetor.id}`
        : '/api/setores'

      const response = await fetch(url, {
        method: editingSetor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: tenantSchema,
          nome: formData.nome,
          departamento_nivel: parseInt(formData.departamento_nivel),
          departamento_ids: formData.departamento_ids
        })
      })

      const responseData = await response.json().catch(() => null) as ApiErrorResponse | null

      if (!response.ok) {
        throw new Error(
          responseData?.message
          || responseData?.error
          || 'Erro ao salvar setor'
        )
      }

      toast.success(
        `Setor ${editingSetor ? 'atualizado' : 'cadastrado'} com sucesso`,
        { description: formData.nome }
      )

      handleCloseDialog()
      loadSetores()
    } catch (error) {
      console.error('Error saving setor:', error)
      const description = error instanceof Error
        ? error.message
        : 'Tente novamente em alguns instantes'

      toast.error('Erro ao salvar setor', {
        description
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSetor = async (id: number) => {
    if (!confirm('Deseja realmente excluir este setor?')) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/setores/${id}?schema=${tenantSchema}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Erro ao excluir setor')

      toast.success('Setor excluído com sucesso')

      loadSetores()
    } catch (error) {
      console.error('Error deleting setor:', error)
      toast.error('Erro ao excluir setor', {
        description: 'Tente novamente em alguns instantes'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleDepartamento = (deptId: number) => {
    setFormData(prev => ({
      ...prev,
      departamento_ids: prev.departamento_ids.includes(deptId)
        ? prev.departamento_ids.filter(id => id !== deptId)
        : [...prev.departamento_ids, deptId]
    }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setores Cadastrados</CardTitle>
          <CardDescription className="text-xs">
            Gerencie os setores e seus departamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && setores.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : setores.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum setor cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Nível</TableHead>
                  <TableHead className="text-xs">Departamentos</TableHead>
                  <TableHead className="text-right text-xs">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {setores.map(setor => (
                  <TableRow key={setor.id}>
                    <TableCell className="font-medium text-sm">{setor.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        Nível {setor.departamento_nivel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {setor.departamento_ids.length} departamento(s)
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialogFunc(setor)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSetor(setor.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingSetor ? 'Editar' : 'Novo'} Setor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure o setor e selecione os departamentos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome" className="text-xs">Nome do Setor *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Açougue, Padaria, Bebidas..."
                className="h-9 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="nivel" className="text-xs">Nível de Departamento *</Label>
              <Select
                value={formData.departamento_nivel}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  departamento_nivel: value,
                  departamento_ids: [] // Reset selection on level change
                }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="text-sm">Nível 1</SelectItem>
                  <SelectItem value="2" className="text-sm">Nível 2</SelectItem>
                  <SelectItem value="3" className="text-sm">Nível 3</SelectItem>
                  <SelectItem value="4" className="text-sm">Nível 4</SelectItem>
                  <SelectItem value="5" className="text-sm">Nível 5</SelectItem>
                  <SelectItem value="6" className="text-sm">Nível 6</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Departamentos *</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {departamentos.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-3">
                    Nenhum departamento encontrado neste nível
                  </div>
                ) : (
                  departamentos.map((dept) => {
                    const conflito = getConflitoDepartamento(dept.departamento_id)
                    const selecionado = formData.departamento_ids.includes(dept.departamento_id)
                    const bloqueado = !selecionado && conflito !== null

                    return (
                      <div key={dept.departamento_id} className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`dept-${dept.departamento_id}`}
                            checked={selecionado}
                            disabled={bloqueado}
                            onCheckedChange={() => toggleDepartamento(dept.departamento_id)}
                          />
                          <label
                            htmlFor={`dept-${dept.departamento_id}`}
                            className={`text-xs font-medium leading-none ${bloqueado ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}
                          >
                            <span className="font-mono text-muted-foreground">{dept.departamento_id}</span> - {dept.descricao}
                          </label>
                        </div>

                        {conflito && (
                          <p className="pl-6 text-[11px] text-destructive">
                            Já vinculado aos setores ativos: {conflito.setores.join(', ')}.
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formData.departamento_ids.length} departamento(s) selecionado(s)
              </p>
              {conflitosSelecionados.length > 0 && (
                <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive">
                  Há departamentos selecionados que entram em conflito com setores ativos. Ajuste a seleção antes de salvar.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} size="sm">
              Cancelar
            </Button>
            <Button onClick={handleSaveSetor} disabled={loading} size="sm">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
