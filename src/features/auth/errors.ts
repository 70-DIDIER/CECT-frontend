import { ApiError } from '@/lib/api'

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Une erreur est survenue. Réessayez.'
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Identifiant ou mot de passe incorrect.'
    case 'TOO_MANY_LOGIN_ATTEMPTS':
    case 'OTP_SEND_LIMIT_REACHED':
      return 'Trop de tentatives. Réessayez dans quelques minutes.'
    case 'OTP_RESEND_TOO_SOON':
      return 'Patientez un instant avant de demander un nouveau code.'
    case 'ACCOUNT_DISABLED':
      return 'Ce compte est suspendu ou fermé. Contactez la CECT.'
    case 'ACCOUNT_NOT_ACTIVATED':
      return "Ce compte n'a pas encore été activé."
    case 'OTP_INVALID':
      return 'Code invalide ou expiré.'
    case 'OTP_LOCKED':
      return 'Trop d’essais sur ce code. Demandez-en un nouveau.'
    case 'PAYMENT_PROVIDER_UNAVAILABLE':
      return 'Le service de paiement est momentanément indisponible. Réessayez plus tard.'
    case 'PAYMENT_FEES_NOT_CONFIGURED':
      return 'Le paiement est temporairement indisponible. La configuration du prestataire doit être finalisée.'
    case 'PAYMENT_METHOD_NOT_AVAILABLE':
      return 'Ce moyen de paiement n’est pas disponible actuellement.'
    case 'NETWORK_ERROR':
      return error.message
    default:
      return error.correlationId ? `Une erreur est survenue (réf. ${error.correlationId}).` : 'Une erreur est survenue. Réessayez.'
  }
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(error.fieldErrors).map(([field, messages]) => [field, messages[0] ?? '']))
}

[executed on device: ip-172-31-20-3 (266007aa-ed81-449a-969b-4ac5ea49fe76)]