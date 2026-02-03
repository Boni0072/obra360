import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Plus, Trash2, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Definição dos perfis solicitados
const ROLES = [
  { value: "engenharia", label: "Engenharia" },
  { value: "diretoria", label: "Diretoria" },
  { value: "aprovacao", label: "Aprovação" },
  { value: "classificacao", label: "Classificação" },
];

// Páginas disponíveis para controle de acesso
const AVAILABLE_PAGES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Obras" },
  { id: "assets", label: "Ativos" },
  { id: "budgets", label: "Budgets" },
  { id: "inventory", label: "Inventário" },
  { id: "reports", label: "Relatórios" },
  { id: "accounting", label: "Contabilidade" },
  { id: "users", label: "Usuários" },
];

export default function UserPage() {
  // Hooks do TRPC (assumindo que o router 'users' existe ou será criado no backend)
  const { data: users, isLoading, refetch, isError } = trpc.users.list.useQuery();
  const createMutation = trpc.users.create.useMutation();
  const updateMutation = trpc.users.update.useMutation();
  const deleteMutation = trpc.users.delete.useMutation();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estado do formulário
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "", // Adicionado campo de senha
    role: "engenharia",
    allowedPages: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "", // Resetar campo de senha
      role: "engenharia",
      allowedPages: [],
    });
    setEditingId(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  };

  const handleEdit = (user: any) => {
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      allowedPages: user.allowedPages || [],
      password: "", // Não preencher a senha ao editar por segurança
    });
    setEditingId(user.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formData,
          password: formData.password || undefined, // Enviar senha apenas se preenchida
        });
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("Usuário criado com sucesso!");
      }
      setOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      toast.error(editingId ? "Erro ao atualizar usuário" : "Erro ao criar usuário");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Usuário removido com sucesso!");
      refetch();
    } catch (error) {
      toast.error("Erro ao remover usuário");
    }
  };

  const togglePagePermission = (pageId: string) => {
    setFormData(prev => {
      const pages = prev.allowedPages.includes(pageId)
        ? prev.allowedPages.filter(p => p !== pageId)
        : [...prev.allowedPages, pageId];
      return { ...prev, allowedPages: pages };
    });
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <div className="bg-red-100 p-4 rounded-full">
          <AlertTriangle className="h-10 w-10 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Erro de Conexão com o Backend</h2>
        <p className="text-gray-600 max-w-md">Não foi possível carregar a lista de usuários. Verifique se o router <code>users</code> foi registrado no <code>appRouter</code> do backend.</p>
        <Button onClick={() => refetch()} variant="outline">Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-700">Gerenciamento de Usuários</h1>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={20} />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Nome</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@empresa.com"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Senha</Label>
                <Input
                  type="text" // Alterado para 'text' para exibir a senha. ATENÇÃO: Isso não é uma prática de segurança recomendada.
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Deixe em branco para manter a senha atual"
                  minLength={6}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Perfil</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v) => setFormData({ ...formData, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Acesso às Páginas</Label>
                <div className="grid grid-cols-2 gap-3 border rounded-md p-4 bg-slate-50">
                  {AVAILABLE_PAGES.map((page) => (
                    <div key={page.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`page-${page.id}`}
                        checked={formData.allowedPages.includes(page.id)}
                        onCheckedChange={() => togglePagePermission(page.id)}
                      />
                      <label 
                        htmlFor={`page-${page.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {page.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Usuários Cadastrados</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Shield size={12} />
                      {ROLES.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.allowedPages?.map((pageId: string) => {
                        const page = AVAILABLE_PAGES.find(p => p.id === pageId);
                        return page ? (
                          <span key={pageId} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border">
                            {page.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil size={16} className="text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 size={16} className="text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
