#!/usr/bin/env bash
# Vérifie que l'abonnement Azure ne contient que des ressources gratuites.
# À lancer dans Azure Cloud Shell (Bash) :
#   bash <(curl -fsSL https://raw.githubusercontent.com/JulienChantail/vibe-workout-tracker-deploy/main/scripts/azure-free-check.sh)
# Ne modifie rien : il lit la configuration et signale ce qui pourrait coûter.

warnings=0
ok()   { echo "  OK  $*"; }
warn() { echo "  !!  $*"; warnings=$((warnings + 1)); }
title() { echo; echo "=== $*"; }

title "Abonnement"
az account show --query "{nom:name, offre:subscriptionPolicies.quotaId, etat:state}" -o table

title "Toutes les ressources de l'abonnement"
az resource list --query "sort_by([], &resourceGroup)[].{groupe:resourceGroup, nom:name, type:type}" -o table

title "Ressources payantes connues"
paid_types="Microsoft.ContainerRegistry/registries Microsoft.Network/publicIPAddresses Microsoft.Network/loadBalancers Microsoft.Network/natGateways Microsoft.Network/applicationGateways Microsoft.Compute/virtualMachines Microsoft.Compute/disks Microsoft.Storage/storageAccounts Microsoft.Web/serverFarms Microsoft.Sql/servers/elasticPools"
found=0
for t in $paid_types; do
  for r in $(az resource list --resource-type "$t" --query "[].join('/', [resourceGroup, name])" -o tsv); do
    warn "$t : $r"
    found=1
  done
done
[ "$found" = 0 ] && ok "aucune (pas de registre ACR, d'IP publique, de load balancer, de VM, de disque, de compte de stockage)"

title "Azure SQL"
while read -r server group; do
  [ -z "$server" ] && continue
  while IFS=$'\t' read -r db free behavior; do
    if [ "$free" = "True" ] && [ "$behavior" = "AutoPause" ]; then
      ok "base $db : offre gratuite, pause automatique si le quota est épuisé"
    else
      warn "base $db : offre gratuite = $free, si quota épuisé = $behavior (attendu : True / AutoPause)"
    fi
  done < <(az sql db list -g "$group" -s "$server" --query "[?name!='master'].[name, useFreeLimit, freeLimitExhaustionBehavior]" -o tsv)
  state=$(az sql server advanced-threat-protection-setting show -g "$group" -n "$server" --query state -o tsv 2>/dev/null)
  if [ "$state" = "Enabled" ]; then
    warn "serveur $server : Microsoft Defender for SQL est activé (payant)"
  else
    ok "serveur $server : Microsoft Defender for SQL désactivé"
  fi
done < <(az sql server list --query "[].[name, resourceGroup]" -o tsv)

title "Microsoft Defender for Cloud (plans payants de l'abonnement)"
plans=$(az security pricing list --query "(value || @)[?pricingTier=='Standard'].name" -o tsv 2>/dev/null)
if [ -n "$plans" ]; then
  warn "plans payants activés : $(echo $plans)"
else
  ok "aucun plan payant activé"
fi

title "Container Apps"
while IFS=$'\t' read -r env group; do
  [ -z "$env" ] && continue
  profiles=$(az containerapp env show -n "$env" -g "$group" --query "properties.workloadProfiles[].workloadProfileType" -o tsv 2>/dev/null | sort -u | tr '\n' ' ')
  subnet=$(az containerapp env show -n "$env" -g "$group" --query "properties.vnetConfiguration.infrastructureSubnetId" -o tsv 2>/dev/null)
  if [ -z "$profiles" ] || [ "$profiles" = "Consumption " ]; then
    ok "environnement $env : plan Consumption uniquement"
  else
    warn "environnement $env : profils $profiles(seul Consumption est couvert par le quota gratuit)"
  fi
  [ -n "$subnet" ] && warn "environnement $env : réseau virtuel personnalisé (peut créer une IP publique et un load balancer payants)"
done < <(az containerapp env list --query "[].[name, resourceGroup]" -o tsv)

while IFS=$'\t' read -r app group; do
  [ -z "$app" ] && continue
  read -r image minr maxr cpu mem < <(az containerapp show -n "$app" -g "$group" --query "[properties.template.containers[0].image, to_string(properties.template.scale.minReplicas), to_string(properties.template.scale.maxReplicas), to_string(properties.template.containers[0].resources.cpu), properties.template.containers[0].resources.memory]" -o tsv | tr '\n' ' ')
  registries=$(az containerapp show -n "$app" -g "$group" --query "properties.configuration.registries[].server" -o tsv)
  echo "  --  appli $app : image $image"
  if [ "$minr" = "0" ] || [ "$minr" = "null" ]; then
    ok "appli $app : s'éteint quand personne ne l'utilise (min replicas = 0)"
  else
    warn "appli $app : min replicas = $minr, elle tourne en permanence et consomme le quota"
  fi
  [ "$maxr" != "1" ] && warn "appli $app : max replicas = $maxr (1 suffit)"
  case "$registries" in
    *azurecr.io*) warn "appli $app : encore configurée avec un registre Azure ($registries)" ;;
  esac
  hours=$(awk -v c="$cpu" -v m="${mem%Gi}" 'BEGIN { a = 180000 / c / 3600; b = 360000 / m / 3600; printf "%d", (a < b ? a : b) }')
  ok "appli $app : $cpu vCPU / $mem → environ $hours h de fonctionnement gratuites par mois"
done < <(az containerapp list --query "[].[name, resourceGroup]" -o tsv)

title "Log Analytics (logs)"
while IFS=$'\t' read -r ws group retention quota; do
  [ -z "$ws" ] && continue
  if [ "$retention" -gt 31 ] 2>/dev/null; then
    warn "espace $ws : conservation $retention jours (au-delà de 31 jours, c'est payant)"
  else
    ok "espace $ws : conservation $retention jours"
  fi
  if [ "$quota" = "-1.0" ] || [ "$quota" = "-1" ]; then
    echo "  --  espace $ws : pas de plafond journalier (5 Go/mois gratuits ; voir DEPLOY-AZURE.md pour en poser un)"
  else
    ok "espace $ws : plafond de $quota Go par jour"
  fi
done < <(az monitor log-analytics workspace list --query "[].[name, resourceGroup, to_string(retentionInDays), to_string(workspaceCapping.dailyQuotaGb)]" -o tsv)

echo
if [ "$warnings" = 0 ]; then
  echo "Résultat : rien de payant détecté."
else
  echo "Résultat : $warnings point(s) à vérifier (lignes marquées !!)."
fi
echo "Pour le montant réel : portail Azure > Cost Management > Analyse des coûts."
