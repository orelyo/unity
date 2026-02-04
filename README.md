# Home Assignment – Buy List System

A simple system where a user can buy random items and view all purchased items. Built with a customer-facing web server, a customer management API, MongoDB, and Kafka.

- **Customer-facing Web Server**: Serves the UI, handles "buy" (publishes to Kafka) and "getAllUserBuys" (GET from API)
- **API Server (Customer Management)**: Reads/writes MongoDB, consumes Kafka purchase events, exposes GET route for all customer purchases.
- **MongoDB**: Stores purchases in database `production_shadow_db_v9`.
- **Kafka**: Purchase events (username, userid, price, timestamp) flow from web server to API server.

## Prerequisites 

Assumes a **clean workspace**: repo cloned, no cluster running, no images built yet.

Install on your machine:

- **Docker** – [install](https://docs.docker.com/get-docker/)
- **kubectl** – [install](https://kubernetes.io/docs/tasks/tools/)
- **minikube** – `curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 && sudo install minikube-linux-amd64 /usr/local/bin/minikube`

---

## How to Run 

**Step 1 – Go to project root**

```bash
cd /path/to/your/workspace
```

**Step 2 – Start a new cluster**

```bash
minikube start
```

Wait until it’s ready, then check:

```bash
kubectl get nodes
```

You should see one node in `Ready`.

**Step 3 – Use Minikube’s Docker (so built images are seen by the cluster)**

```bash
eval $(minikube docker-env)
```

Leave this terminal in the same shell for the next steps, or run this command again in any new terminal where you will run `docker build`.

**Step 4 – Build the app images (no pre-built images; build from source)**

```bash
docker build -t api-server-customer-management:latest ./api-server
docker build -t customer-facing-web-server:latest ./web-server
```

**Step 5 – Deploy infrastructure (MongoDB, Zookeeper, Kafka)**

We deploy three components: **MongoDB** (stores purchases), **Zookeeper** (used by Kafka), and **Kafka** (event stream). Manifests: `mongodb-*`, and `kafka-deployment.yaml` (includes Zookeeper + Kafka).

```bash
kubectl apply -f kubernetes/mongodb-deployment.yaml
kubectl apply -f kubernetes/mongodb-service.yaml
kubectl apply -f kubernetes/kafka-deployment.yaml
```

**Step 6 – Wait for infrastructure pods**

```bash
kubectl get pods -w
```

Wait until `mongodb-*`, `zookeeper-*`, and `kafka-*` are **Running**. Then press **Ctrl+C**. If Kafka is not ready, wait 30–60 seconds and check again.

**Step 7 – Deploy the application**

```bash
kubectl apply -f kubernetes/api-server-config.yaml
kubectl apply -f kubernetes/web-server-config.yaml
kubectl apply -f kubernetes/api-server-deployment.yaml
kubectl apply -f kubernetes/api-server-service.yaml
kubectl apply -f kubernetes/web-server-deployment.yaml
kubectl apply -f kubernetes/web-server-service.yaml
```

Then install **KEDA** (see [KEDA](#keda-use-case-relevant-autoscaling) below) and apply the ScaledObject so the API server scales on **Kafka consumer lag**.

**Step 8 – Wait for app pods**

```bash
kubectl get pods
```

Wait until `api-server-customer-management-*` and `customer-facing-web-server-*` are **Running** and **1/1** ready.

**Step 9 – Open the web app**

Either run:

```bash
minikube service customer-facing-web-server
```

and open the URL it prints, or in another terminal:

```bash
kubectl port-forward svc/customer-facing-web-server 3000:80
```

Then open **http://localhost:3000** in your browser.

**Step 10 – Use the app**

- Enter **Username** and **User ID**, click **Buy**, then **getAllUserBuys** to see purchases.

### See scale-up working (use-case-relevant metrics)

The assignment asks for autoscaling based on **metrics relevant to the use case**; the hint says CPU and memory are not the only options. We use **Kafka consumer lag** for the API server.

**API server (Kafka consumer lag):**

1. Create lag: scale the API server to 0 (`kubectl scale deployment api-server-customer-management --replicas=0`), send many `POST /buy` requests from the UI, then scale back to 1.
2. KEDA will see lag &gt; 10 and scale the API server up. Watch: `kubectl get deployment api-server-customer-management` and `kubectl get hpa`.


---

---

## KEDA (use-case-relevant autoscaling)

Per the assignment, autoscaling must be based on **metrics relevant to the use case**; the hint says *CPU and memory are not the only metrics you can use*. In this solution we use **only Kafka consumer lag** for autoscaling:

- **API server**: **Kafka consumer lag** – when messages pile up on the `purchases` topic, more API server replicas drain the backlog (relevant to event processing).

No CPU or memory metrics are used for autoscaling in the main setup. The web server runs with a fixed replica count in this solution.

### Install KEDA (once per cluster)

From the project root, install KEDA using the official release YAML:

```bash
kubectl apply -f https://github.com/kedacore/keda/releases/download/v2.12.0/keda-2.12.0.yaml
```

Wait until KEDA pods are running:

```bash
kubectl get pods -n keda
```

You should see `keda-operator`, `keda-metrics-apiserver`, and (optionally) `keda-admission` in **Running** state.

### Apply ScaledObject (after app and Kafka are running)

Apply **after** infrastructure and the application are deployed (Steps 5–8 above):

```bash
kubectl apply -f kubernetes/api-server-keda-scaledobject.yaml
```

### ScaledObject summary

| Component   | Trigger | Metric                      | Meaning                             |
|------------|---------|-----------------------------|-------------------------------------|
| API server | Kafka   | Consumer lag on `purchases` | Scale when lag &gt; 10 messages |

- **API server**: `bootstrapServers: kafka.default.svc.cluster.local:9092`, `consumerGroup: customer-management-consumer-v2`, `lagThreshold: 10`, min 1 / max 5 replicas.

### Verify KEDA is working

```bash
kubectl get scaledobject
kubectl describe scaledobject api-server-kafka-scaledobject
kubectl get hpa
```

- **READY: True** and **ACTIVE: True** on the ScaledObject mean autoscaling is healthy.
- Ensure Kafka pods are **Running** and reachable (use FQDN `kafka.default.svc.cluster.local`).

### Without KEDA

If you do not install KEDA, omit the ScaledObject. There is no CPU/memory HPA in this setup; autoscaling is done only via KEDA with the **Kafka consumer lag** metric.

---

## CI/CD

- **GitHub Actions** (`.github/workflows/ci-cd.yml`): runs tests, builds Docker images, pushes to GitHub Container Registry (GHCR), and has a deploy job that applies Kubernetes manifests (configure kubeconfig via secrets for your cluster).
- **Tests:** `npm test` in `api-server` and `web-server`.
- **Artifacts:** Docker images for API server and web server (GHCR). For Docker Hub, set registry and login in the workflow.

## Project Layout

```
api-server/          # Customer Management API (Express, MongoDB, Kafka consumer)
web-server/           # Customer-facing server (Express, Kafka producer, static UI)
kubernetes/           # K8s manifests (Deployments, Services, ConfigMaps, KEDA)
.github/workflows/    # CI/CD pipeline
```

## API Summary

- **Web server**
  - `POST /buy` – body: `{ username, userId }` – publishes (username, userid, price, timestamp) to Kafka; price/timestamp default if omitted.
  - `GET /getAllUserBuys?userId=...` – proxies to API server and returns all purchases for that user.
- **API server**
  - `GET /buyList?userId=...` – returns all customer purchases for the given userId from MongoDB.

## Autoscaling

Per the assignment: *"Add autoscaling resources for the software components based on metrics that are relevant to the use case"* with the hint that *CPU and memory are not the only metrics you can use*. We use **use-case-relevant metrics** only:

- **API server**: **KEDA** scales on **Kafka consumer lag** (`api-server-keda-scaledobject.yaml`) – relevant to event processing: when the purchase-event backlog grows, more replicas drain it (min 1 / max 5).
- **Web server**: runs with a fixed replica count (no autoscaling in this solution).

We do **not** use CPU or memory as the primary autoscaling metrics; the only HPA in the main flow is the one created by KEDA for the API server (Kafka lag trigger).

All Kubernetes resources use the assignment UUID as the label `assignment-uuid: e271b052-9200-4502-b491-62f1649c07`.
