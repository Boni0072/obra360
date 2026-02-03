import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ExpensesPage() {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "projects"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(data);
    });
    return () => unsubscribe();
  }, []);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { data: expenses, isLoading, refetch } = trpc.expenses.listByProject.useQuery(
    { projectId: selectedProjectId || "" },
    { enabled: !!selectedProjectId }
  );

  const selectedProject = projects?.find(p => String(p.id) === String(selectedProjectId));
  // Bloqueia despesas se o projeto já foi aprovado pela diretoria (status 'aprovado', 'em_andamento', 'concluido')
  const isBlocked = selectedProject?.status === 'aprovado' || selectedProject?.status === 'em_andamento' || selectedProject?.status === 'concluido';

  const { data: assets } = trpc.assets.list.useQuery(
    { projectId: selectedProjectId || undefined },
    { enabled: !!selectedProjectId }
  );

  const createMutation = trpc.expenses.create.useMutation();
  const updateMutation = trpc.expenses.update.useMutation();
  const deleteMutation = trpc.expenses.delete.useMutation();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nfeKey, setNfeKey] = useState("");
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    quantity: "1",
    type: "capex" as "capex" | "opex",
    category: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    assetId: null as string | null,
  });

  const fetchNfeMutation = trpc.expenses.fetchNfeData.useMutation();

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      quantity: "1",
      type: "capex",
      category: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      assetId: null,
    });
    setEditingId(null);
    setNfeKey("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  };

  const handleEdit = (expense: any) => {
    setFormData({
      description: expense.description,
      amount: expense.amount,
      quantity: expense.quantity ? String(expense.quantity) : "1",
      type: expense.type,
      category: expense.category || "",
      date: expense.date ? new Date(expense.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      notes: expense.notes || "",
      assetId: expense.assetId ? String(expense.assetId) : null,
    });
    setEditingId(expense.id);
    setOpen(true);
  };

  const handleFetchNfe = async () => {
    if (!nfeKey || nfeKey.length !== 44) {
      toast.error("Por favor, insira uma chave de acesso válida com 44 dígitos.");
      return;
    }
    try {
      const data = await fetchNfeMutation.mutateAsync({ accessKey: nfeKey });
      
      // Adiciona um alerta para dados de ambiente de homologação (teste)
      const isHomologacao = data.notes?.toUpperCase().includes("HOMOLOGACAO") || 
                           data.description?.toUpperCase().includes("HOMOLOGACAO") ||
                           data.description?.toUpperCase().includes("SEM VALOR FISCAL");

      if (isHomologacao) {
        toast.warning("Ambiente de Teste (Homologação)", {
          description: "O sistema retornou dados fictícios. Verifique a configuração do backend para Produção.",
          duration: 5000,
        });
      } else {
        toast.success("Dados da NF-e importados com sucesso!");
      }

      setFormData(prev => ({
        ...prev,
        description: data.description || prev.description,
        amount: data.amount ? String(data.amount) : prev.amount,
        date: data.date && !isNaN(new Date(data.date).getTime()) ? new Date(data.date).toISOString().split("T")[0] : prev.date,
        notes: `NF-e: ${nfeKey}. ${data.notes || ''}`.trim(),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
      toast.error("Falha ao buscar dados da NF-e.", {
        description: `Verifique a chave de acesso e a conexão. Detalhe: ${errorMessage}`
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error("Selecione uma obra");
      return;
    }

    if (isBlocked && !editingId) {
      toast.error("Este projeto já foi aprovado e as despesas estão bloqueadas.");
      return;
    }

    const submissionData = {
      projectId: selectedProjectId,
      description: formData.description,
      amount: formData.amount,
      quantity: Number(formData.quantity) || 1,
      type: formData.type,
      category: formData.category || "",
      date: new Date(formData.date),
      notes: formData.notes || "",
      assetId: formData.type === 'capex' ? formData.assetId : null,
    };

    console.log({ assetIdType: typeof submissionData.assetId, assetIdValue: submissionData.assetId });

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...submissionData,
        });
        toast.success("Despesa atualizada com sucesso!");
      } else {
        await createMutation.mutateAsync(submissionData);
        toast.success("Despesa criada com sucesso!");
      }
      setOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error.message || (editingId ? "Erro ao atualizar despesa" : "Erro ao criar despesa"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Despesa deletada com sucesso!");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar despesa");
    }
  };

  const totalCapex = expenses?.filter(e => e.type === 'capex').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalOpex = expenses?.filter(e => e.type === 'opex').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalGeneral = totalCapex + totalOpex;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-700">Despesas</h1>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={20} />
              Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Despesa" : "Registrar Nova Despesa"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto p-4 -mx-4 space-y-4 flex-1"> {/* Added scrollable div */}
              <div className="space-y-2 p-4 border rounded-lg bg-slate-50">
                <label className="text-sm font-medium">Importar da NF-e (Opcional)</label>
                <div className="flex gap-2">
                  <Input
                    value={nfeKey}
                    onChange={(e) => setNfeKey(e.target.value.replace(/\D/g, ''))}
                    placeholder="Digite os 44 dígitos da chave de acesso"
                    maxLength={44}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFetchNfe}
                    disabled={fetchNfeMutation.isPending}
                  >
                    {fetchNfeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Nota: Se os dados retornados não forem reais, o sistema pode estar em modo de teste (homologação). A consulta a dados reais deve ser configurada no servidor.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Obra</label>
                <Select value={selectedProjectId || ""} onValueChange={(v) => setSelectedProjectId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma obra" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {(p.status === 'aprovado' || p.status === 'em_andamento' || p.status === 'concluido') ? '(Bloqueado)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjectId && isBlocked && !editingId && (
                <div className="flex items-center gap-2 p-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle size={16} />
                  <span>Projeto aprovado/concluído. Despesas bloqueadas.</span>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Compra de cimento"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Valor (R$)</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Quantidade</label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as "capex" | "opex" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capex">Capex (Capital)</SelectItem>
                    <SelectItem value="opex">Opex (Operacional)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.type === "capex" && (
                <div>
                  <label className="text-sm font-medium">Vincular ao Ativo</label>
                  <Select 
                    value={formData.assetId === null ? "none" : String(formData.assetId)} 
                    onValueChange={(v) => setFormData({ ...formData, assetId: v === "none" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um ativo (Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {assets?.map((asset) => (
                        <SelectItem key={asset.id} value={String(asset.id)}>
                          {asset.tagNumber ? `${asset.tagNumber} - ${asset.name}` : asset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Materiais"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data</label>
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notas</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações adicionais..."
                  className="min-h-[120px]"
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending || (isBlocked && !editingId)}>
                {createMutation.isPending || updateMutation.isPending ? "Salvando..." : (editingId ? "Atualizar Despesa" : "Registrar Despesa")}
              </Button>
            </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Selection */}
      <Card className="p-6">
        <label className="text-sm font-medium">Selecione uma Obra</label>
        <Select value={selectedProjectId || ""} onValueChange={(v) => setSelectedProjectId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma obra" />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Summary */}
      {selectedProjectId && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <p className="text-gray-500 text-sm mb-2">Total Capex</p>
            <p className="text-3xl font-bold text-blue-600">R$ {totalCapex.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </Card>
          <Card className="p-6">
            <p className="text-gray-500 text-sm mb-2">Total Opex</p>
            <p className="text-3xl font-bold text-green-600">R$ {totalOpex.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </Card>
        </div>
      )}

      {/* Expenses List */}
      {selectedProjectId && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="animate-spin" />
            </div>
          ) : expenses && expenses.length > 0 ? (
            <div className="rounded-md border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Conta Contábil</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>{expense.category || "—"}</TableCell>
                      <TableCell>{new Date(expense.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-center">{(expense as any).quantity || 1}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          expense.type === 'capex' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {expense.type.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>{(expense as any).accountingAccount || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={expense.notes || ""}>
                        {expense.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold">R$ {Number(expense.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                        onClick={() => handleEdit(expense)}
                      >
                            <Pencil size={16} className="text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                        onClick={() => handleDelete(expense.id)}
                        disabled={deleteMutation.isPending}
                      >
                            <Trash2 size={16} className="text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot className="bg-slate-50 font-bold">
                  <TableRow>
                    <TableCell colSpan={6} className="text-right">Total Acumulado</TableCell>
                    <TableCell className="text-right">
                      R$ {totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-gray-500">Nenhuma despesa registrada para esta obra.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
