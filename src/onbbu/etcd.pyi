from etcd3 import Etcd3Client as Etcd3Client # type: ignore

def get_etcd_client() -> Etcd3Client: ...

etcd_client: Etcd3Client
