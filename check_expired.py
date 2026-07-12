import json
from datetime import datetime, timezone
import os

KEYS_FILE = 'keys.json'

def desativar_keys_expiradas():
    """
    Verifica todas as keys no keys.json e desativa as que expiraram.
    """
    
    # Verifica se o arquivo existe
    if not os.path.exists(KEYS_FILE):
        print(f"❌ Arquivo {KEYS_FILE} não encontrado!")
        return
    
    # Carrega o arquivo
    with open(KEYS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    now = datetime.now(timezone.utc)
    modificado = False
    
    print(f"🕐 Verificando keys... ({now.strftime('%Y-%m-%d %H:%M:%S')} UTC)")
    print(f"📊 Total de keys: {len(data.get('keys', []))}")
    print("")
    
    for key in data.get('keys', []):
        # Só verifica keys ativas com data de expiração
        if key.get('active', True) and key.get('expires_at'):
            try:
                expires_at = datetime.fromisoformat(key['expires_at'].replace('Z', '+00:00'))
                
                if now > expires_at:
                    key['active'] = False
                    key['desativado_em'] = now.isoformat()
                    print(f"🔴 Key desativada: {key['key']}")
                    print(f"   👤 Usuário: {key.get('user', 'Desconhecido')}")
                    print(f"   📅 Expirou em: {key['expires_at']}")
                    print(f"   📊 Plano: {key.get('plan', 'N/A')}")
                    print("")
                    modificado = True
                else:
                    # Mostra keys que ainda estão válidas (para debug)
                    dias_restantes = (expires_at - now).days
                    print(f"✅ {key['key']} - Válida ({dias_restantes} dias restantes)")
                    
            except Exception as e:
                print(f"⚠️ Erro ao processar key {key.get('key', 'unknown')}: {e}")
    
    # Salva se houve mudança
    if modificado:
        with open(KEYS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print("")
        print("✅ Keys atualizadas com sucesso!")
    else:
        print("")
        print("ℹ️ Nenhuma key expirada encontrada.")

if __name__ == "__main__":
    desativar_keys_expiradas()
