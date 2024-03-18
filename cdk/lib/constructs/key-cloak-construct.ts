import {StackProps, Stack, CfnOutput} from "aws-cdk-lib";
import {Construct} from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sm from "aws-cdk-lib/aws-secretsmanager";

export interface KeyCloakConstructProps extends StackProps {
    readonly vpc: ec2.IVpc;
}

const defaultProps: Partial<KeyCloakConstructProps> = {};

export class KeyCloakConstruct extends Construct {
    constructor(scope: Construct, name: string, props: KeyCloakConstructProps) {
        super(scope, name);

        props = {...defaultProps, ...props};

        const adminPassword = new sm.Secret(this, 'AdminPassword', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'admin' }),
                generateStringKey: 'password',
                passwordLength: 16,
                excludePunctuation: true,
            },
        })

        const userPassword = new sm.Secret(this, 'UserPassword', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'bayer' }),
                generateStringKey: 'password',
                passwordLength: 16,
                excludePunctuation: true,
            },
        })

        const installPreReq = ec2.UserData.forLinux()
        installPreReq.addCommands(
            'sudo yum update -y',
            'sudo yum install -y jq',
            'sudo amazon-linux-extras install -y docker',
            'sudo systemctl start docker',
            'sudo usermod -a -G docker ec2-user',
            'sudo systemctl enable docker',
            '(echo "AA"; echo "BB"; echo "CC"; echo "DD"; echo "EE"; echo "FF"; echo "GG") | openssl req -newkey rsa:2048 -nodes -keyout keycloak-server.key.pem -x509 -days 3650 -out keycloak-server.crt.pem',
            'sudo mkdir /opt/certs',
            'sudo mv keycloak-server.* /opt/certs',
            'sudo chmod 655 /opt/certs/*',
            `ADMIN_PASS=$(aws secretsmanager get-secret-value --region ${Stack.of(this).region} --secret-id ${adminPassword.secretName} | jq -r ".SecretString | fromjson | .password")`,
            `USER_PASS=$(aws secretsmanager get-secret-value --region ${Stack.of(this).region} --secret-id ${userPassword.secretName} | jq -r ".SecretString | fromjson | .password")`,
            'sudo docker run -d -p 80:8080 -p 443:8443 -v /opt/certs:/opt/certs -e KC_HTTPS_CERTIFICATE_FILE=/opt/certs/keycloak-server.crt.pem -e KC_HTTPS_CERTIFICATE_KEY_FILE=/opt/certs/keycloak-server.key.pem -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=$ADMIN_PASS --name key quay.io/keycloak/keycloak:22.0.4 start-dev',
            'sleep 120',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh update realms/master -s sslRequired=NONE"',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh create groups -r master -s name=Admins;./kcadm.sh create groups -r master -s name=SA;./kcadm.sh create groups -r master -s name=ML_SME_SA;./kcadm.sh create groups -r master -s name=DB_SME_SA"',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh create users -r master -b \'{\\"enabled\\":\\"true\\",\\"username\\":\\"martha_rivera\\",\\"email\\":\\"martha_rivera@example.com\\",\\"emailVerified\\":\\"true\\",\\"firstName\\":\\"martha_rivera\\",\\"groups\\":[\\"Admins\\"],\\"credentials\\":[{\\"type\\":\\"password\\",\\"value\\":\\"$USER_PASS\\",\\"temporary\\":\\"false\\"}]}\'"',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh create users -r master -b \'{\\"enabled\\":\\"true\\",\\"username\\":\\"pat_candella\\",\\"email\\":\\"pat_candella@example.com\\",\\"emailVerified\\":\\"true\\",\\"firstName\\":\\"pat_candella\\",\\"groups\\":[\\"SA\\"],\\"credentials\\":[{\\"type\\":\\"password\\",\\"value\\":\\"$USER_PASS\\",\\"temporary\\":\\"false\\"}]}\'"',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh create users -r master -b \'{\\"enabled\\":\\"true\\",\\"username\\":\\"mateo_jackson\\",\\"email\\":\\"mateo_jackson@example.com\\",\\"emailVerified\\":\\"true\\",\\"firstName\\":\\"mateo_jackson\\",\\"groups\\":[\\"DB_SME_SA\\"],\\"credentials\\":[{\\"type\\":\\"password\\",\\"value\\":\\"$USER_PASS\\",\\"temporary\\":\\"false\\"}]}\'"',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh create users -r master -b \'{\\"enabled\\":\\"true\\",\\"username\\":\\"john_doe\\",\\"email\\":\\"john_doe@example.com\\",\\"emailVerified\\":\\"true\\",\\"firstName\\":\\"john_doe\\",\\"groups\\":[\\"ML_SME_SA\\"],\\"credentials\\":[{\\"type\\":\\"password\\",\\"value\\":\\"$USER_PASS\\",\\"temporary\\":\\"false\\"}]}\'"',
            'sudo docker exec key /bin/bash -c "cd /opt/keycloak/bin;./kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password $ADMIN_PASS;./kcadm.sh create users -r master -b \'{\\"enabled\\":\\"true\\",\\"username\\":\\"mary_major\\",\\"email\\":\\"mary_major@example.com\\",\\"emailVerified\\":\\"true\\",\\"firstName\\":\\"mary_major\\",\\"credentials\\":[{\\"type\\":\\"password\\",\\"value\\":\\"$USER_PASS\\",\\"temporary\\":\\"false\\"}]}\'"',
        )

        const keycloak_server = new ec2.Instance(this, 'KeycloakServer', {
            vpc: props.vpc,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux2(),
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            userData: installPreReq,
            userDataCausesReplacement: true,
        })
        keycloak_server.connections.allowFromAnyIpv4(ec2.Port.tcp(443), 'Allow HTTPS from anywhere')
        keycloak_server.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'Allow HTTP from anywhere')

        adminPassword.grantRead(keycloak_server)
        userPassword.grantRead(keycloak_server)

        new CfnOutput(this, 'KeyCloakUrl', {
            value: `https://${keycloak_server.instancePublicDnsName}/`
        });

        new CfnOutput(this, 'KeyCloakAdminPasswordSecretName', {
            value: adminPassword.secretName
        });

        new CfnOutput(this, 'KeyCloakUserPasswordSecretName', {
            value: userPassword.secretName
        });

    }

}