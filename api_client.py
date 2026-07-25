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
    response = requests.get(f"{DAEMON_URL}/api/v1/metrics", headers=headers)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def list_containers():
    print("\n--- 🐳 Liste des Conteneurs ---")
    response = requests.get(f"{DAEMON_URL}/api/v1/containers", headers=headers)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def create_hello_world_container():
    print("\n--- 🚀 Création d'un conteneur Hello World ---")
    payload = {
        "server_id": "test-hello-world-1",
        "image": "hello-world",
        "memory_mb": 512,
        "cpu_limit": 1.0,
        "ports": [],
        "env": {
            "TEST_VAR": "HELLO"
        }
    }
    response = requests.post(f"{DAEMON_URL}/api/v1/containers", headers=headers, json=payload)
    if response.status_code == 200:
        print_json(response.json())
    else:
        print(f"Erreur: {response.status_code} - {response.text}")

def start_container(container_id):
    print(f"\n--- ⚡ Démarrage du conteneur {container_id} ---")
    response = requests.post(
        f"{DAEMON_URL}/api/v1/containers/{container_id}/power",
        headers=headers,
        json={"action": "start"}
    )
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
    # create_hello_world_container()
    
    # 4. Attendre quelques secondes puis le démarrer (décommentez pour tester)
    # time.sleep(2)
    # start_container("test-hello-world-1")
