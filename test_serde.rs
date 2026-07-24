use serde::Deserialize;
#[derive(Deserialize, Debug)]
struct Session {
    uuid: String,
    ipv6: Option<String>,
}
fn main() {
    let j = r#"{"uuid": "abc"}"#;
    let res: Result<Session, _> = serde_json::from_str(j);
    println!("{:?}", res);
}
