import requests
import json
import time

# Configuration
# Change l'URL si tu l'exécutes depuis ton PC vers ton VPS distant (remplace 127.0.0.1 par l'IP du VPS)
DAEMON_URL = "http://145.239.78.165:8080" 
NODE_TOKEN = "123" # Le token défini dans DAEMON_NODE_TOKEN au lancement du daemon

headers = {
    "X-Node-Token": NODE_TOKEN,
    "Content-Type": "application/json"
}

def print_json(data):
    print(json.dumps(data, indent=2))

def get_system_metrics():
    print("--- 📊 Métriques Système ---")
    response = requests.get(f"{DAEMON_URL}/api/v1/node/metrics", headers=headers)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def list_containers():
    print("\n--- 🐳 Liste des Conteneurs ---")
    response = requests.get(f"{DAEMON_URL}/api/v1/servers", headers=headers)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def create_hello_world_container():
    print("\n--- 🚀 Création d'un conteneur Hello World ---")
    payload = {
        "spec": {
            "server_id": "test-hello-world-1",
            "name": "Hello World Test",
            "image": "hello-world",
            "ports": [],
            "volumes": [],
            "env": [
                "TEST_VAR=HELLO"
            ],
            "resources": {
                "memory_limit_bytes": 512 * 1024 * 1024
            }
        }
    }
    response = requests.post(f"{DAEMON_URL}/api/v1/servers", headers=headers, json=payload)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def start_container(container_id):
    print(f"\n--- ⚡ Démarrage du conteneur {container_id} ---")
    response = requests.post(
        f"{DAEMON_URL}/api/v1/servers/{container_id}/power",
        headers=headers,
        json={"action": "start"}
    )
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def get_all_endpoints():
    print("\n--- 📋 Tous les Endpoints (Discovery) ---")
    response = requests.get(f"{DAEMON_URL}/api/v1", headers=headers)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def get_metadata():
    print("\n--- 📋 Métadonnées ---")
    response = requests.get(f"{DAEMON_URL}/api/v1/metadata", headers=headers)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")


if __name__ == "__main__":
    print(f"Test de l'API vps-panel sur {DAEMON_URL}...")
    
    # 1. Vérifier les stats du VPS
    get_system_metrics()
    
    # 2. Lister les conteneurs actuels
    list_containers()
    
    # 3. Créer un conteneur de test (décommentez pour tester)
    create_hello_world_container()
    

    # 5. Get `/api/v1` (All Endpoints)
    get_all_endpoints()

    # 6. Get `/api/v1/metadata`
    get_metadata()
    
    # 4. Attendre quelques secondes puis le démarrer (décommentez pour tester)
    time.sleep(2)
    start_container("test-hello-world-1")
    
