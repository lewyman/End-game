import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/sign-in", { replace: true }); }, [navigate]);
  return null;
}
