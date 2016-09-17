Requirement
-----

Create and Add following secrets to webtask

- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- ALERT_TOPIC_ARN


Create strict IAM policy
-----

__policygen-ec2-tags-ro-webtask-201609171532__

``` json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Stmt1474106403000",
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstanceAttribute",
                "ec2:DescribeInstanceStatus",
                "ec2:DescribeInstances",
                "ec2:DescribeKeyPairs",
                "ec2:DescribeReservedInstances",
                "ec2:DescribeReservedInstancesListings",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeTags"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```

__policygen-sns-publish-webtask-201609171542__

``` json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "Stmt1474107060000",
            "Effect": "Allow",
            "Action": [
                "sns:Publish"
            ],
            "Resource": [
                "arn:aws:sns:ap-southeast-1:xxx:ec2_audit_alert"
            ]
        }
    ]
}
```