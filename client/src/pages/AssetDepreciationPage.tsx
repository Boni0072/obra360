import React, { useState, useMemo } from 'react';
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface DepreciationData {
  assetId: string;
  assetName: string;
  assetNumber: string;
  assetValue: number;
  residualValue: number;
  usefulLife: number; // in months
  monthlyDepreciation: number;
  depreciationStartDate: Date;
  depreciationEndDate: Date;
  monthlyBreakdown: { month: string; depreciation: number; accumulated: number; bookValue: number }[];
}

export default function AssetDepreciationPage() {
  const { data: projects } = trpc.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const { data: assets, isLoading } = trpc.assets.list.useQuery(
    { projectId: selectedProjectId || undefined, status: "concluido" },
    {
      // Only fetch assets with status 'concluido' as they are the ones being depreciated
    }
  );

  const getAssetValue = (asset: any) => {
    // This is a simplified version. In a real scenario, you might need to fetch related expenses
    // to get the full value, as done in AssetsPage. For now, we'll use the asset's own value.
    return Number(asset.value || 0);
  };

  const depreciationData = useMemo((): DepreciationData | null => {
    if (!selectedAssetId || !assets) return null;

    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset || !asset.availabilityDate || !asset.usefulLife) return null;

    const assetValue = getAssetValue(asset);
    const residualValue = Number(asset.residualValue || 0);
    const usefulLifeInMonths = Number(asset.usefulLife) * 12;
    const depreciableValue = assetValue - residualValue;
    
    if (usefulLifeInMonths <= 0) return null;

    const monthlyDepreciation = depreciableValue / usefulLifeInMonths;
    const depreciationStartDate = new Date(asset.availabilityDate);
    
    // Set start date to the beginning of the next month
    depreciationStartDate.setMonth(depreciationStartDate.getMonth() + 1);
    depreciationStartDate.setDate(1);


    const depreciationEndDate = new Date(depreciationStartDate);
    depreciationEndDate.setMonth(depreciationEndDate.getMonth() + usefulLifeInMonths);

    const monthlyBreakdown: { month: string; depreciation: number; accumulated: number; bookValue: number }[] = [];
    let accumulated = 0;
    let currentBookValue = assetValue;

    for (let i = 0; i < usefulLifeInMonths; i++) {
      const currentDate = new Date(depreciationStartDate);
      currentDate.setMonth(currentDate.getMonth() + i);
      
      accumulated += monthlyDepreciation;
      currentBookValue -= monthlyDepreciation;

      monthlyBreakdown.push({
        month: currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        depreciation: monthlyDepreciation,
        accumulated: accumulated,
        bookValue: currentBookValue,
      });
    }

    return {
      assetId: asset.id,
      assetName: asset.name,
      assetNumber: (asset as any).assetNumber,
      assetValue,
      residualValue,
      usefulLife: usefulLifeInMonths,
      monthlyDepreciation,
      depreciationStartDate,
      depreciationEndDate,
      monthlyBreakdown,
    };
  }, [assets, selectedAssetId]);

  return (
    <div className="space-y-6 mt-4">
      <Card className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-2">Selecione uma Obra</label>
            <Select value={selectedProjectId || "all"} onValueChange={(v) => {
              setSelectedProjectId(v === "all" ? null : v);
              setSelectedAssetId(null); // Reset asset selection
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por obra..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Obras</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Selecione um Ativo</label>
            <Select value={selectedAssetId || ""} onValueChange={setSelectedAssetId} disabled={isLoading || !assets}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um ativo para ver o cálculo..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading && <div className="flex items-center justify-center p-4"><Loader2 className="animate-spin" /></div>}
                {assets && assets.length > 0 ? (
                  assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id.toString()}>
                      {asset.name} ({ (asset as any).assetNumber})
                    </SelectItem>
                  ))
                ) : (
                  <div className="text-center text-sm text-muted-foreground p-4">Nenhum ativo concluído nesta obra.</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {selectedAssetId && (
        isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin" />
          </div>
        ) : depreciationData ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Mapa de Depreciação - {depreciationData.assetName}</h2>
            <div className="grid grid-cols-4 gap-4 mb-6 text-sm border rounded-lg p-4">
              <div><span className="font-medium text-muted-foreground">Valor do Ativo:</span> R$ {depreciationData.assetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><span className="font-medium text-muted-foreground">Valor Residual:</span> R$ {depreciationData.residualValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><span className="font-medium text-muted-foreground">Vida Útil:</span> {depreciationData.usefulLife} meses</div>
              <div className="font-bold"><span className="font-medium text-muted-foreground">Depreciação Mensal:</span> R$ {depreciationData.monthlyDepreciation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><span className="font-medium text-muted-foreground">Início Depreciação:</span> {depreciationData.depreciationStartDate.toLocaleDateString('pt-BR')}</div>
              <div><span className="font-medium text-muted-foreground">Fim Depreciação:</span> {depreciationData.depreciationEndDate.toLocaleDateString('pt-BR')}</div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês/Ano</TableHead>
                    <TableHead className="text-right">Quota de Depreciação</TableHead>
                    <TableHead className="text-right">Depreciação Acumulada</TableHead>
                    <TableHead className="text-right">Valor Contábil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Initial State */}
                  <TableRow className="bg-slate-50 font-medium">
                    <TableCell>Data de Ativação ({new Date(assets?.find(a=>a.id === selectedAssetId)?.availabilityDate || "").toLocaleDateString('pt-BR')})</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">R$ 0,00</TableCell>
                    <TableCell className="text-right">R$ {depreciationData.assetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                  {depreciationData.monthlyBreakdown.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="capitalize">{row.month}</TableCell>
                      <TableCell className="text-right text-red-600">(- R$ {row.depreciation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</TableCell>
                      <TableCell className="text-right">R$ {row.accumulated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-medium">R$ {row.bookValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-gray-500">Não foi possível calcular a depreciação. Verifique se o ativo selecionado possui 'Data de Disponibilidade' e 'Vida Útil' preenchidas.</p>
          </Card>
        )
      )}
    </div>
  );
}
