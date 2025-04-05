import os
from etcd3 import client, Etcd3Client  # type: ignore


def get_etcd_client() -> Etcd3Client:
    host = os.getenv("ETCD_HOST", "localhost")
    port = int(os.getenv("ETCD_PORT", 2379))
    ca_cert = os.getenv("ETCD_CA_CERT")
    cert_key = os.getenv("ETCD_CERT_KEY")
    cert_cert = os.getenv("ETCD_CERT_CERT")
    timeout = int(os.getenv("ETCD_TIMEOUT", 30))
    user = os.getenv("ETCD_USER")
    password = os.getenv("ETCD_PASSWORD")
    grpc_options = None

    return client(
        host=host,
        port=port,
        ca_cert=ca_cert,
        cert_key=cert_key,
        cert_cert=cert_cert,
        timeout=timeout,
        user=user,
        password=password,
        grpc_options=grpc_options,
    )


etcd_client: Etcd3Client = get_etcd_client()
