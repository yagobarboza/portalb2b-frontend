import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, PackageCheck } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

interface PurchaseRules {
  min_order_value: number | null;
  min_order_quantity: number | null;
}

export default function PurchaseRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [minValue, setMinValue] = useState('');
  const [minQty, setMinQty] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PurchaseRules>('/companies/purchase-rules');
      setMinValue(data.min_order_value != null ? String(data.min_order_value) : '');
      setMinQty(data.min_order_quantity != null ? String(data.min_order_quantity) : '');
    } catch {
      toast.error('Não foi possível carregar as regras de compra.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: PurchaseRules = {
        min_order_value: minValue.trim() === '' ? null : Number(minValue.replace(',', '.')),
        min_order_quantity: minQty.trim() === '' ? null : Math.trunc(Number(minQty)),
      };
      await api.patch<PurchaseRules>('/companies/purchase-rules', payload);
      toast.success('Regras de compra atualizadas.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao salvar as regras.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="py-16 text-center text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Regras de Compra</h1>
        <p className="text-sm text-muted-foreground">
          Defina a quantidade mínima de compra que os seus clientes devem atingir.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4" />
            Mínimos de compra
          </CardTitle>
          <CardDescription>
            Deixe em branco para não aplicar a regra. Se preencher os dois, ambos devem ser atingidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="min-value">Valor mínimo do pedido (R$)</Label>
              <Input
                id="min-value"
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex.: 500,00"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O total do carrinho deve ser igual ou maior que este valor.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-qty">Quantidade mínima (unidades)</Label>
              <Input
                id="min-qty"
                type="number"
                min={0}
                step={1}
                placeholder="Ex.: 10"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A soma das quantidades dos itens deve ser igual ou maior que este número.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar regras'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}