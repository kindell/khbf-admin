import { Navigate, useParams } from 'react-router-dom';

export function MemberRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/members/${id}`} replace />;
}
