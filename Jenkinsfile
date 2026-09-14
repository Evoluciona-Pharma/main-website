pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '15'))
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['staging', 'production'],
            description: 'Staging deploys branch staging to 4.227.178.18. Production deploys main — set the prod host first.'
        )
    }

    environment {
        SSH_OPTS             = '-o StrictHostKeyChecking=no'
        DOCKER               = 'docker'

        PROJECT_NAME         = 'main-website'
        GIT_REPO             = 'https://github.com/Evoluciona-Pharma/main-website.git'
        GIT_CREDENTIALS_ID   = 'github-credentials'

        IMAGE_NAME           = 'main-website'
        CONTAINER_NAME       = 'main-website'
        // Next listens on 3001 inside the image. Host 8080 matches the old
        // STG-WEBSITE mapping so nginx for staging.evolucionapharma.com can
        // keep proxying to 127.0.0.1:8080 (hub front uses 8081).
        APP_PORT             = '8080'
        CONTAINER_PORT       = '3001'
        KEEP_IMAGES          = '3'
    }

    stages {
        stage('Resolve target') {
            steps {
                script {
                    def isProd = params.ENVIRONMENT == 'production'
                    env.DEPLOY_BRANCH = isProd ? 'main' : 'staging'
                    env.DEPLOY_USER = env.WEBSITE_DEPLOY_USER ?: 'azureuser'
                    env.DEPLOY_HOST = isProd
                        ? (env.WEBSITE_PROD_HOST ?: '')
                        : (env.WEBSITE_STG_HOST ?: '4.227.178.18')
                    env.SSH_CREDENTIALS_ID = isProd
                        ? (env.WEBSITE_PROD_SSH_CREDENTIALS ?: 'prod-ssh-key')
                        : (env.WEBSITE_STG_SSH_CREDENTIALS ?: 'stg-deploy-ssh')
                    // Baked into the Next bundle. Override when DevOps gives
                    // the real API host. Empty localhost would break browsers.
                    env.NEXT_PUBLIC_API_URL = isProd
                        ? (env.WEBSITE_PROD_API_URL ?: '')
                        : (env.WEBSITE_STG_API_URL ?: 'https://api-stg.evolucionapharma.com')

                    if (!env.DEPLOY_HOST?.trim()) {
                        error 'Production host is empty. Set WEBSITE_PROD_HOST on this job (copy DEPLOY_HOST from the old PROD-WEBSITE job if you have it).'
                    }
                    if (!env.NEXT_PUBLIC_API_URL?.trim()) {
                        error 'NEXT_PUBLIC_API_URL is empty. Set WEBSITE_STG_API_URL or WEBSITE_PROD_API_URL on this job.'
                    }
                    echo "Deploy ${params.ENVIRONMENT} → ${env.DEPLOY_USER}@${env.DEPLOY_HOST} branch=${env.DEPLOY_BRANCH} NEXT_PUBLIC_API_URL='${env.NEXT_PUBLIC_API_URL}'"
                }
            }
        }

        stage('Clone Repository') {
            steps {
                git credentialsId: "${GIT_CREDENTIALS_ID}", url: "${GIT_REPO}", branch: "${DEPLOY_BRANCH}"
                script {
                    def sha = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${sha}"
                    echo "Building ${env.IMAGE_NAME}:${env.IMAGE_TAG}"
                }
            }
        }

        stage('Preflight') {
            steps {
                sh '''
                    echo "--- Jenkins agent ---"
                    whoami
                    docker version --format '{{.Server.Version}}' \
                        || { echo "ERROR: agent cannot reach the Docker daemon."; exit 1; }
                '''
                sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {
                    sh '''
                        echo "--- SSH round trip ---"
                        STAMP="jenkins-preflight-${BUILD_NUMBER}-$(date +%s)"
                        ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "
                            echo \\"connected as \\$(whoami)@\\$(hostname)\\"
                            echo '$STAMP' > /tmp/$STAMP.txt
                        "
                        REMOTE=$(ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "cat /tmp/$STAMP.txt")
                        [ "$REMOTE" = "$STAMP" ] || { echo "ERROR: remote write not verified"; exit 1; }
                        ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" \
                            "$DOCKER version --format '{{.Server.Version}}'" \
                            || { echo "ERROR: remote docker unavailable."; exit 1; }
                    '''
                }
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build --pull --target production \
                        --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
                        -t "$IMAGE_NAME:$IMAGE_TAG" \
                        -t "$IMAGE_NAME:latest" \
                        .
                '''
            }
        }

        stage('Ship Image to Server') {
            steps {
                sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {
                    sh '''#!/bin/bash
                        set -euo pipefail
                        docker save "$IMAGE_NAME:$IMAGE_TAG" \
                            | gzip -1 \
                            | ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "$DOCKER load"
                    '''
                }
            }
        }

        stage('Start Container') {
            steps {
                sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {
                    sh '''
                        ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "
                            $DOCKER rm -f $CONTAINER_NAME 2>/dev/null || true
                            $DOCKER run -d \\
                                --name $CONTAINER_NAME \\
                                --restart unless-stopped \\
                                -p 127.0.0.1:$APP_PORT:$CONTAINER_PORT \\
                                $IMAGE_NAME:$IMAGE_TAG
                            $DOCKER ps --filter name=$CONTAINER_NAME
                        "
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {
                    sh '''
                        set +x
                        for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
                            STATUS=$(ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" \
                                "$DOCKER inspect -f '{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null" || echo unknown)
                            echo "health: $STATUS"
                            case "$STATUS" in
                                healthy) echo "Container healthy."; exit 0 ;;
                                unhealthy) break ;;
                            esac
                            sleep 4
                        done
                        echo "Container did not become healthy."
                        ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "$DOCKER logs --tail=80 $CONTAINER_NAME"
                        exit 1
                    '''
                }
            }
        }

        stage('Prune Images') {
            steps {
                sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {
                    sh '''
                        ssh $SSH_OPTS "$DEPLOY_USER@$DEPLOY_HOST" "
                            $DOCKER images '$IMAGE_NAME' --format '{{.Tag}} {{.ID}}' \
                                | grep -v '^latest ' \
                                | tail -n +\\$(( $KEEP_IMAGES + 1 )) \
                                | awk '{print \\$2}' \
                                | xargs -r $DOCKER rmi -f || true
                            $DOCKER image prune -f || true
                        "
                        docker images "$IMAGE_NAME" --format '{{.Tag}} {{.ID}}' \
                            | grep -v '^latest ' \
                            | tail -n +$(( KEEP_IMAGES + 1 )) \
                            | awk '{print $2}' \
                            | xargs -r docker rmi -f || true
                        docker image prune -f || true
                    '''
                }
            }
        }
    }

    post {
        success { echo "${PROJECT_NAME} ${env.IMAGE_TAG ?: '(untagged)'} deployed to ${params.ENVIRONMENT}." }
        failure { echo "${PROJECT_NAME} deployment failed." }
    }
}
