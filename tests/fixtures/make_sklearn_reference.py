# Regenerates tests/fixtures/sklearn-reference.json (scikit-learn is the reference for the TypeScript port):
#   uv run --with scikit-learn --with numpy python tests/fixtures/make_sklearn_reference.py <a ClusterSearch .ndjson response>
import json, base64, sys
import numpy as np
from sklearn.cluster import HDBSCAN
from sklearn.decomposition import PCA
from sklearn.datasets import make_blobs

out = {}
def hd(X):
    return HDBSCAN(max_cluster_size=80, min_cluster_size=5, min_samples=1, copy=True).fit_predict(X).tolist()

# synthetic: blobs of different density plus scattered noise, 6 dims
X, _ = make_blobs(n_samples=[40, 30, 25, 20], n_features=6, cluster_std=[0.6, 0.9, 0.5, 1.2], random_state=7, center_box=(-12, 12))
rng = np.random.default_rng(3)
X = np.vstack([X, rng.uniform(-14, 14, size=(15, 6))])
out["blobs"] = {"points": X.round(6).tolist(), "labels": hd(X)}

# real: Qwen3 embeddings from a live ClusterSearch response, thesis pipeline (PCA to 40% variance, then HDBSCAN)
rows = []
for line in open(sys.argv[1]):
    e = json.loads(line)
    if e.get("t") == "papers" and e.get("vectors"):
        v = e["vectors"]; b = np.frombuffer(base64.b64decode(v["data"]), dtype=np.int8).astype(np.float64).reshape(-1, v["dims"])
        b /= np.linalg.norm(b, axis=1, keepdims=True)
        rows.append(b)
E = np.round(np.vstack(rows) * 1e4) / 1e4  # the exact values the JS test reads back
pca = PCA(n_components=min(E.shape)).fit(E)
k = int(np.argmax(np.cumsum(pca.explained_variance_ratio_) >= 0.4) + 1)
P = PCA(n_components=k, svd_solver="full").fit_transform(E)  # exact; "auto" picks the approximate randomized solver here
out["real"] = {"embeddings": base64.b64encode(np.round(E * 1e4).astype(np.int16).tobytes()).decode(), "dims": E.shape[1], "n": E.shape[0], "pcaComponents": k, "labels": hd(P)}
json.dump(out, open("reference.json", "w"))
print("blobs", len(out["blobs"]["labels"]), "clusters", len(set(out["blobs"]["labels"]) - {-1}), "| real n", E.shape[0], "k", k, "clusters", len(set(out["real"]["labels"]) - {-1}), "noise", out["real"]["labels"].count(-1))
