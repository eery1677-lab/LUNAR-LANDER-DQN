import argparse
import os
import sys
from huggingface_hub import HfApi, create_repo, get_token

def upload_model_to_hf(repo_id=None, token=None, model_path="dqn_lunar_lander_best.pt"):
    print("=" * 65)
    print("🤗 Hugging Face 모델 업로드를 시작합니다...")
    print("=" * 65)

    # 1. Resolve Token
    hf_token = token or os.environ.get("HF_TOKEN") or get_token()
    if not hf_token:
        try:
            print("\n🔑 Hugging Face 인증 토큰이 필요합니다.")
            print("   (https://huggingface.co/settings/tokens 에서 Write 권한 토큰 발급)")
            hf_token = input("👉 Hugging Face Write Token을 입력하세요: ").strip()
        except Exception:
            hf_token = None

        if not hf_token:
            print("❌ 토큰이 입력되지 않아 업로드를 취소합니다.")
            return False, "Hugging Face Write Token이 필요합니다."

    api = HfApi(token=hf_token)
    
    try:
        user_info = api.whoami(token=hf_token)
        username = user_info.get("name") or user_info.get("username")
        print(f"✅ Hugging Face 계정 인증 성공: @{username}")
    except Exception as e:
        err_msg = f"토큰 인증에 실패했습니다: {e}"
        print(f"❌ {err_msg}")
        return False, err_msg

    # 2. Resolve Repository ID
    if not repo_id:
        default_repo = f"{username}/LunarLander-v3-DQN"
        try:
            repo_input = input(f"👉 저장소 이름을 입력하세요 (기본값: {default_repo}): ").strip()
            repo_id = repo_input if repo_input else default_repo
        except Exception:
            repo_id = default_repo
    elif "/" not in repo_id:
        repo_id = f"{username}/{repo_id}"

    print(f"\n📦 대상 저장소: https://huggingface.co/{repo_id}")

    # 3. Create Repo if not exists
    try:
        print("🚀 저장소 생성/확인 중...")
        create_repo(repo_id=repo_id, repo_type="model", exist_ok=True, token=hf_token)
        print("✅ 저장소 준비 완료!")
    except Exception as e:
        err_msg = f"저장소 생성 중 오류: {e}"
        print(f"❌ {err_msg}")
        return False, err_msg

    # 4. Check model file
    if not os.path.exists(model_path):
        if os.path.exists("dqn_lunar_lander.pt"):
            model_path = "dqn_lunar_lander.pt"
        else:
            err_msg = f"업로드할 모델 가중치 파일({model_path})을 찾을 수 없습니다."
            print(f"❌ {err_msg}")
            return False, err_msg

    # 5. Upload files
    files_to_upload = [
        (model_path, "dqn_lunar_lander_best.pt"),
        ("dqn_agent.py", "dqn_agent.py"),
        ("requirements.txt", "requirements.txt"),
    ]

    card_path = "hf_model_card.md" if os.path.exists("hf_model_card.md") else "README.md"
    files_to_upload.append((card_path, "README.md"))

    print("\n📤 파일 업로드 진행 중...")
    try:
        for local_path, hf_path in files_to_upload:
            if os.path.exists(local_path):
                print(f"   ⬆️  {local_path} -> {hf_path} 업로드 중...")
                api.upload_file(
                    path_or_fileobj=local_path,
                    path_in_repo=hf_path,
                    repo_id=repo_id,
                    repo_type="model",
                    token=hf_token
                )
    except Exception as e:
        err_msg = f"파일 업로드 중 오류 발생: {e}"
        print(f"❌ {err_msg}")
        return False, err_msg

    model_url = f"https://huggingface.co/{repo_id}"
    print("\n" + "=" * 65)
    print("🎉 허깅페이스 모델 업로드가 성공적으로 완료되었습니다!")
    print(f"🔗 모델 링크: {model_url}")
    print("=" * 65)
    return True, model_url

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload LunarLander DQN to Hugging Face")
    parser.add_argument("--repo-id", type=str, default=None, help="Hugging Face repo id (예: username/LunarLander-v3-DQN)")
    parser.add_argument("--token", type=str, default=None, help="Hugging Face Write Token")
    parser.add_argument("--model-path", type=str, default="dqn_lunar_lander_best.pt", help="Path to .pt weights")
    args = parser.parse_args()

    success, result = upload_model_to_hf(repo_id=args.repo_id, token=args.token, model_path=args.model_path)
    if not success:
        sys.exit(1)
