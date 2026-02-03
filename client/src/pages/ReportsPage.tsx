import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, CheckCircle2, FileText, User, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface InventoryResult {
  assetId: string;
  newCostCenter: string;
  verified: boolean;
}

interface InventorySchedule {
  id: string;
  requesterId?: string; // Opcional para suportar agendamentos antigos
  assetIds: string[];
  userIds: string[];
  date: string;
  notes: string;
  status: 'pending' | 'waiting_approval' | 'completed';
  results?: InventoryResult[];
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<InventorySchedule[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "inventory_schedules"), (snapshot) => {
      const loadedSchedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventorySchedule[];
      setSchedules(loadedSchedules);
    });
    return () => unsubscribe();
  }, []);

  const { data: users } = trpc.users.list.useQuery();
  const { data: assets } = trpc.assets.list.useQuery();
  const updateAssetMutation = trpc.assets.update.useMutation();

  // Garante a leitura do ID independente do formato do objeto user
  const currentUserId = (user as any)?.id || (user as any)?.openId || (user as any)?.uid || (user as any)?.sub;

  const handleApproveInventory = async (schedule: InventorySchedule) => {
    if (!schedule.results) return;

    try {
      // Atualiza os ativos com os novos centros de custo
      for (const result of schedule.results) {
        if (result.verified && result.newCostCenter) {
          await updateAssetMutation.mutateAsync({
            id: result.assetId,
            costCenter: result.newCostCenter
          } as any);
        }
      }

      const scheduleRef = doc(db, "inventory_schedules", schedule.id);
      await updateDoc(scheduleRef, { status: 'completed' });

      toast.success("Inventário aprovado e ativos atualizados com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar ativos. Tente novamente.");
    }
  };

  // Filtra agendamentos que precisam de aprovação do usuário atual (solicitante)
  // Adicionado String() para garantir comparação correta e fallback (!s.requesterId) para itens legados
  const pendingApprovals = schedules.filter(s => 
    s.status === 'waiting_approval' && (!s.requesterId || String(s.requesterId) === String(currentUserId))
  );

  // Filtra agendamentos concluídos para histórico
  const completedSchedules = schedules.filter(s => 
    s.status === 'completed' && (!s.requesterId || String(s.requesterId) === String(currentUserId))
  );

  const handleExportReport = (schedule: InventorySchedule) => {
    if (!assets) return;

    const reportData = schedule.assetIds.map(id => {
      const asset = assets.find(a => a.id === id);
      const result = schedule.results?.find(r => r.assetId === id);
      
      // Find Cost Center Code/Name
      const currentCC = typeof asset?.costCenter === 'object' ? (asset.costCenter as any).code : asset?.costCenter;
      const newCC = result?.newCostCenter || currentCC;

      return {
        "Nº Ativo": asset?.assetNumber || "-",
        "Nome": asset?.name || "-",
        "Centro de Custo Anterior": currentCC || "-",
        "Novo Centro de Custo": newCC || "-",
        "Status": result?.verified ? "Verificado" : "Não Verificado"
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    
    // Ajusta largura das colunas
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];

    // Adiciona linhas para assinatura
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [],
      ["__________________________", "__________________________"],
      ["Assinatura do Solicitante", "Assinatura do Responsável"],
      [`Data: ${new Date().toLocaleDateString()}`]
    ], { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório de Inventário");
    XLSX.writeFile(wb, `relatorio_inventario_${new Date(schedule.date).toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-700 flex items-center gap-2">
        <FileText className="h-8 w-8" />
        Relatórios e Aprovações
      </h1>

      {/* Seção de Aprovações Pendentes */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-800 text-lg">
            <CheckCircle2 className="h-5 w-5" />
            Aprovações de Inventário Pendentes ({pendingApprovals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingApprovals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingApprovals.map(schedule => (
                <div key={schedule.id} className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-slate-800">
                        Realizado em: {new Date(schedule.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      <p><strong>{schedule.assetIds.length}</strong> ativos verificados.</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <User className="h-3 w-3" />
                        Responsáveis: {schedule.userIds.map(uid => users?.find(u => u.id === uid)?.name).filter(Boolean).join(", ") || "N/A"}
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => handleApproveInventory(schedule)} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    Aceitar Contagem e Atualizar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-blue-600/80">Nenhuma aprovação pendente no momento.</p>
          )}
        </CardContent>
      </Card>

      {/* Seção de Histórico de Inventários Concluídos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-slate-700 text-lg">
            <FileText className="h-5 w-5" />
            Histórico de Inventários Concluídos
          </CardTitle>
        </CardHeader>
        <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Ativo</TableHead>
                 <TableHead>Nome</TableHead>
                 <TableHead>CC Anterior</TableHead>
                 <TableHead>Novo CC</TableHead>
                 <TableHead className="text-right">Status</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {completedSchedules.map(schedule => (
                 <React.Fragment key={schedule.id}>
                 <TableRow className="bg-slate-100 hover:bg-slate-100">
                   <TableCell colSpan={5} className="py-3">
                     <div className="flex justify-between items-center">
                       <div className="flex items-center gap-4 text-sm">
                         <div className="font-semibold flex items-center gap-2 text-slate-700">
                           <CalendarIcon className="w-4 h-4" />
                           {new Date(schedule.date).toLocaleDateString()}
                         </div>
                         <div className="flex items-center gap-2 text-slate-600">
                           <User className="w-4 h-4" />
                           {schedule.userIds.map(uid => users?.find(u => u.id === uid)?.name).filter(Boolean).join(", ")}
                         </div>
                       </div>
                       <Button variant="outline" size="sm" onClick={() => handleExportReport(schedule)} className="h-8 bg-white border-slate-300 hover:bg-slate-50">
                         <Download className="w-3 h-3 mr-2" /> Exportar Relatório
                       </Button>
                     </div>
                   </TableCell>
                 </TableRow>
                 {schedule.assetIds.map(id => {
                   const asset = assets?.find(a => a.id === id);
                   const result = schedule.results?.find(r => r.assetId === id);
                   const currentCC = typeof asset?.costCenter === 'object' ? (asset.costCenter as any).code : asset?.costCenter;
                   return (
                     <TableRow key={id} className="hover:bg-slate-50/50">
                       <TableCell className="font-mono text-xs pl-6">{asset?.assetNumber}</TableCell>
                       <TableCell>{asset?.name}</TableCell>
                       <TableCell className="text-muted-foreground">{currentCC || "-"}</TableCell>
                       <TableCell className={result?.newCostCenter !== currentCC ? "text-orange-600 font-bold" : ""}>
                         {result?.newCostCenter || currentCC || "-"}
                       </TableCell>
                       <TableCell className="text-right">
                          {result?.verified ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Verificado
                              </span>
                          ) : (
                              <span className="text-muted-foreground text-xs">Pendente</span>
                          )}
                       </TableCell>
                     </TableRow>
                   );
                 })}
                 </React.Fragment>
               ))}
               {completedSchedules.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                     Nenhum inventário concluído.
                   </TableCell>
                 </TableRow>
               )}
             </TableBody>
           </Table>
        </CardContent>
      </Card>
    </div>
  );
}